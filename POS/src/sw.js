/**
 * Custom Service Worker — injectManifest mode
 *
 * Why this exists (the blank-white-screen problem):
 * -------------------------------------------------
 * frappe-ui with `jinjaBootData: true` generates pos_next/public/pos/index.html
 * with raw Jinja template tags:
 *
 *   {% for key in boot %}
 *   window["{{ key }}"] = {{ boot[key] | tojson }};
 *   {% endfor %}
 *
 * Frappe's HTTP server renders those tags before delivering the page.
 * If `html` is included in VitePWA's globPatterns, the SW precaches the
 * *raw* unrendered file.  Serving it offline causes:
 *
 *   Uncaught SyntaxError: Unexpected token '%'
 *   → Vue app fails to initialize → blank white screen
 *
 * Two-layer fix:
 * 1. `html` is removed from globPatterns in vite.config.js (not precached).
 * 2. This file caches the server-rendered HTML at runtime (RENDERED_SHELL_CACHE)
 *    and serves it when the server is down.  If the user has never been online
 *    with this SW version, a hardcoded fallback HTML (no Jinja tags) is served
 *    instead, loading the same JS/CSS chunks from the precache.
 */

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"

// ── Auto-update ───────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim())
})

// ── Precache build assets (html excluded — see module comment) ─────────────────
// workbox-build's injectManifest requires self.__WB_MANIFEST to appear exactly
// once in the source file.  Capture it here; buildOfflineFallbackHtml() reads
// WB_MANIFEST (the variable), not self.__WB_MANIFEST a second time.
const WB_MANIFEST = self.__WB_MANIFEST
precacheAndRoute(WB_MANIFEST)
cleanupOutdatedCaches()

// ── Navigation handler ────────────────────────────────────────────────────────
// Cache name for the last successfully Jinja-rendered HTML page.
const RENDERED_SHELL_CACHE = "pos-rendered-shell-v1"
// Key used to store/retrieve the rendered shell (always the root POS URL).
const RENDERED_SHELL_KEY = "/pos"
// HTTP status codes that indicate Frappe/Gunicorn is down but nginx is up.
const SERVER_DOWN_STATUSES = new Set([502, 503, 520, 521, 522, 523, 524])
// Abort navigation fetch after this many ms to avoid indefinite spinner.
const NAV_TIMEOUT_MS = 10_000

/**
 * Build a minimal HTML document from the precache manifest.
 *
 * This is the "last resort" fallback used only when the user has NEVER
 * successfully loaded the POS with this SW version (rendered-shell cache is
 * empty).  It sets the same window globals that Frappe's Jinja rendering
 * would inject, loads all precached CSS/JS, and lets Vue boot normally.
 *
 * The window globals here are intentionally minimal — the Vue app reads most
 * settings from localStorage/IndexedDB after boot and will override these.
 */
function buildOfflineFallbackHtml() {
	const manifest = /** @type {Array<{url:string}>} */ (WB_MANIFEST || [])

	// Collect CSS files from the build asset folder
	const cssLinks = manifest
		.filter((e) => {
			const u = String(e.url)
			return u.includes("/assets/") && u.endsWith(".css")
		})
		.map((e) => `  <link rel="stylesheet" href="${e.url}">`)
		.join("\n")

	// Collect the main JS entry chunk.
	// Vite names the main entry after the HTML stem: index-HASH.js or main-HASH.js.
	// Worker bundles (offlineWorker etc.) are excluded.
	const jsEntry = manifest
		.filter((e) => {
			const u = String(e.url)
			return (
				u.includes("/assets/") &&
				u.endsWith(".js") &&
				!u.includes("/workers/") &&
				/\/(index|main)-[^/]+\.js$/.test(u)
			)
		})
		.map((e) => `  <script type="module" src="${e.url}"></script>`)
		.join("\n")

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
<meta name="theme-color" content="#4F46E5">
<title>NURSA POS</title>
<script>
/* Minimal boot globals — replaces Frappe Jinja {% for key in boot %} injection.
   The Vue app reads these at startup; cached POS settings (localStorage /
   IndexedDB) take over after the first API round-trip succeeds. */
window["lang"] = "en";
window["sysdefaults"] = {
  "currency": "IDR",
  "date_format": "dd-mm-yyyy",
  "time_format": "HH:mm:ss",
  "float_precision": 3,
  "currency_precision": 2
};
window["sitename"] = location.hostname;
window["frappe"] = window["frappe"] || {};
/* Read CSRF token from session cookie so API calls stay authenticated. */
(function () {
  try {
    var jar = {};
    document.cookie.split("; ").filter(Boolean).forEach(function (p) {
      var kv = p.split("=");
      jar[decodeURIComponent(kv[0])] = decodeURIComponent(kv.slice(1).join("="));
    });
    window["csrf_token"] = jar["csrf_token"] || "unauthorized";
  } catch (e) {
    window["csrf_token"] = "unauthorized";
  }
}());
</script>
${cssLinks}
</head>
<body>
<div id="app"></div>
${jsEntry}
</body>
</html>`
}

async function navHandler({ request }) {
	// ── Try network first ───────────────────────────────────────────────────
	try {
		const controller = new AbortController()
		const timerId = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS)
		let response
		try {
			response = await fetch(request, { signal: controller.signal })
		} finally {
			clearTimeout(timerId)
		}

		if (response.ok) {
			// Server is healthy and Jinja has rendered the HTML.
			// Store the rendered copy so we can serve it when offline later.
			caches
				.open(RENDERED_SHELL_CACHE)
				.then((cache) => cache.put(RENDERED_SHELL_KEY, response.clone()))
				.catch(() => {})
			return response
		}

		// Non-5xx error (e.g. 404): pass through as-is.
		if (!SERVER_DOWN_STATUSES.has(response.status)) return response

		// Fall through to offline path for 5xx server-down codes.
	} catch {
		// Network failure or AbortError (timeout): fall through to offline path.
	}

	// ── Offline path ────────────────────────────────────────────────────────
	// 1. Serve the last cached rendered HTML (Jinja already processed — safe).
	try {
		const cache = await caches.open(RENDERED_SHELL_CACHE)
		const cached = await cache.match(RENDERED_SHELL_KEY)
		if (cached) return cached
	} catch {
		// Cache API failure — continue to hardcoded fallback.
	}

	// 2. No cached rendered HTML (user has never loaded the POS online with
	//    this SW version).  Serve the hardcoded fallback that bootstraps Vue
	//    without any Jinja tags.
	return new Response(buildOfflineFallbackHtml(), {
		status: 200,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	})
}

registerRoute(
	new NavigationRoute(navHandler, {
		allowlist: [/^\/pos/],
		denylist: [/^\/api/, /^\/app/],
	}),
)

// ── Runtime caching ───────────────────────────────────────────────────────────

// Google Fonts (CacheFirst, 1 year)
registerRoute(
	/^https:\/\/fonts\.googleapis\.com\/.*/i,
	new CacheFirst({
		cacheName: "google-fonts-cache",
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
		],
	}),
)
registerRoute(
	/^https:\/\/fonts\.gstatic\.com\/.*/i,
	new CacheFirst({
		cacheName: "gstatic-fonts-cache",
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
		],
	}),
)

// POS static assets — JS, CSS, images bundled by Vite (CacheFirst, 30 days)
registerRoute(
	/\/assets\/pos_next\/pos\/.*/i,
	new CacheFirst({
		cacheName: "pos-assets-cache",
		plugins: [
			new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
		],
	}),
)

// Product images uploaded to Frappe /files/ (StaleWhileRevalidate, 7 days)
registerRoute(
	/\/files\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
	new StaleWhileRevalidate({
		cacheName: "product-images-cache",
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
		],
	}),
)

// API calls (NetworkFirst, 10 s timeout, cached for offline reads)
registerRoute(
	/\/api\/.*/i,
	new NetworkFirst({
		cacheName: "api-cache",
		networkTimeoutSeconds: 10,
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
		],
	}),
)

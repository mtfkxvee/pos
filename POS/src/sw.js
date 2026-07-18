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
// Skip waiting immediately on install so the new SW takes over without
// requiring a tab close — old SWs that precached raw Jinja HTML are replaced
// the moment the new build is installed.
self.addEventListener("install", () => {
	self.skipWaiting()
})

// Also respond to the SKIP_WAITING message sent by workbox-window / our
// manual registration code (belt-and-suspenders approach).
self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("activate", (event) => {
	event.waitUntil(
		Promise.all([
			// Take control of all existing clients immediately.
			self.clients.claim(),
			// Purge any cached HTML files from every cache (including old
			// Workbox precaches that stored the raw Jinja template).
			// This is the one-time migration that clears out the broken
			// cached HTML so it can never be served as the app shell again.
			caches.keys().then(async (names) => {
				for (const name of names) {
					// Leave our rendered-shell cache alone.
					if (name === RENDERED_SHELL_CACHE) continue
					// Only purge stale HTML from Workbox precache buckets.
					// Runtime caches (api-cache, product-images-cache, etc.) never
					// hold raw Jinja HTML, and restricting to precache avoids any
					// risk of accidentally deleting the /pos key from other caches.
					if (!name.includes("-precache-")) continue
					try {
						const cache = await caches.open(name)
						const keys = await cache.keys()
						for (const req of keys) {
							// Delete only .html file entries — not bare /pos navigation
							// URLs, which might be the rendered-shell key in disguise.
							if (req.url.endsWith(".html")) {
								await cache.delete(req)
							}
						}
					} catch {
						// Individual cache errors are non-fatal
					}
				}
			}),
		]),
	)
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
 * Build a minimal HTML document to boot the Vue app when the server is down
 * and no cached rendered shell is available.
 *
 * Strategy (most-reliable first):
 * 1. Scan the actual SW caches to find installed CSS/JS by their real absolute
 *    URLs — avoids any ambiguity about how WB_MANIFEST formats its paths.
 * 2. Fall back to WB_MANIFEST entries, normalising relative URLs to absolute.
 * 3. If assets can't be found at all, still render a retry UI so the user
 *    never sees a blank screen.
 */
async function buildOfflineFallbackHtml() {
	let cssUrls = []
	let entryJsUrl = ""

	// Step 1 — scan real caches (absolute URLs, no format ambiguity).
	try {
		const cacheNames = await caches.keys()
		const allUrls = []
		for (const name of cacheNames) {
			if (name === RENDERED_SHELL_CACHE) continue
			const cache = await caches.open(name)
			const requests = await cache.keys()
			for (const req of requests) allUrls.push(req.url)
		}

		cssUrls = [
			...new Set(
				allUrls.filter(
					(u) =>
						u.includes("pos_next/pos") &&
						u.endsWith(".css") &&
						!u.includes("sw."),
				),
			),
		]

		entryJsUrl =
			allUrls.find(
				(u) =>
					u.includes("pos_next/pos") &&
					u.endsWith(".js") &&
					!u.includes("/workers/") &&
					!u.includes("sw.") &&
					/\/index-[^/]+\.js/.test(u),
			) || ""
	} catch {
		// Cache API unavailable — fall through to manifest.
	}

	// Step 2 — fall back to WB_MANIFEST (normalise relative URLs).
	if (!entryJsUrl) {
		const manifest = /** @type {Array<{url:string}>} */ (WB_MANIFEST || [])
		for (const entry of manifest) {
			const raw = String(entry.url)
			// Normalise: if the manifest emits relative paths (no leading "/"),
			// prepend the known asset base so the browser resolves them correctly.
			const u = raw.startsWith("/") ? raw : `/assets/pos_next/pos/${raw}`
			if (u.endsWith(".css") && !u.includes("sw.")) {
				cssUrls.push(u)
			} else if (
				u.endsWith(".js") &&
				!u.includes("/workers/") &&
				!u.includes("sw.") &&
				/\/index-[^/]+\.js/.test(u) &&
				!entryJsUrl
			) {
				entryJsUrl = u
			}
		}
		cssUrls = [...new Set(cssUrls)]
	}

	const cssLinks = cssUrls.map((u) => `  <link rel="stylesheet" href="${u}">`).join("\n")
	const jsScript = entryJsUrl
		? `  <script type="module" src="${entryJsUrl}"></script>`
		: ""

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
/* Last-resort: if Vue hasn't mounted within 12 s, show a retry button. */
setTimeout(function () {
  var app = document.getElementById("app");
  if (app && app.children.length === 0) {
    app.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'height:100vh;font-family:sans-serif;background:#F9FAFB;color:#111827;text-align:center;padding:24px;">' +
      '<h2 style="margin:0 0 8px;font-size:18px;font-weight:600;">Server tidak tersedia</h2>' +
      '<p style="margin:0 0 24px;color:#6B7280;font-size:14px;max-width:320px;">' +
      'POS tidak dapat memuat karena server sedang offline. Data Anda tetap aman.</p>' +
      '<button onclick="location.reload()" style="padding:10px 28px;background:#4F46E5;color:#fff;' +
      'border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Coba Lagi</button>' +
      '</div>';
  }
}, 12000);
</script>
${cssLinks}
</head>
<body>
<div id="app"></div>
${jsScript}
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
	return new Response(await buildOfflineFallbackHtml(), {
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

/**
 * Custom Service Worker — injectManifest mode
 *
 * Key fix over the previous generateSW approach: Workbox's built-in
 * navigateFallback only activates on network *errors* (throws), not on
 * 5xx HTTP responses (502 "Bad Gateway" etc.).  When Nginx is up but
 * Frappe is down the old SW would return the 502 page to the browser,
 * causing a blank white screen.  This custom navHandler falls back to
 * the cached app shell whenever the server returns 5xx, so the Vue app
 * always loads regardless of server status.
 */

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"

// ── Auto-update ───────────────────────────────────────────────────────────────
// VitePWA (autoUpdate mode) posts SKIP_WAITING when a new SW is waiting.
self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim())
})

// ── Precache all build assets ─────────────────────────────────────────────────
// self.__WB_MANIFEST is replaced by VitePWA at build time with the full asset list.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Navigation handler ────────────────────────────────────────────────────────
// Serves the cached app shell (index.html) even when the server returns a
// "server down" status code (502, 503, 520 …).  Without this custom handler
// those responses would be forwarded to the browser as-is, showing a blank page.

const APP_SHELL_URL = "/assets/pos_next/pos/index.html"
const SERVER_DOWN_STATUSES = new Set([502, 503, 520, 521, 522, 523, 524])
const NAV_TIMEOUT_MS = 10_000

async function navHandler({ request }) {
	try {
		const controller = new AbortController()
		const timerId = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS)
		let response
		try {
			response = await fetch(request, { signal: controller.signal })
		} finally {
			clearTimeout(timerId)
		}

		// Live server response is healthy — pass it through.
		if (response.ok) return response

		// Server returned a "server down" code — fall through to cached shell.
		if (!SERVER_DOWN_STATUSES.has(response.status)) {
			// Other non-OK responses (404, 401 …) pass through as-is.
			return response
		}
	} catch {
		// Network error or AbortError (timeout) — fall through to cached shell.
	}

	// Return cached app shell so the Vue SPA can boot and show an offline UI.
	const cached = await caches.match(APP_SHELL_URL)
	if (cached) return cached

	// Last resort: generic error (the precache should always have index.html).
	return Response.error()
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

// POS static assets (CacheFirst, 30 days)
registerRoute(
	/\/assets\/pos_next\/pos\/.*/i,
	new CacheFirst({
		cacheName: "pos-assets-cache",
		plugins: [
			new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
		],
	}),
)

// Product images (StaleWhileRevalidate, 7 days)
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

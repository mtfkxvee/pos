/**
 * NURSA POS - Application Entry Point
 *
 * Initialization sequence:
 * 1. Register PWA service worker
 * 2. Configure Vue app with plugins and global components
 * 3. Authenticate user and initialize CSRF token (in parallel)
 * 4. Preload bootstrap data for faster page rendering
 * 5. Register router and mount app
 */

import { createPinia } from "pinia"
import { createApp } from "vue"

import App from "./App.vue"
import { session, sessionUser } from "./data/session"
import { userResource } from "./data/user"
import router from "./router"
import {
	createCSRFAwareRequest,
	ensureCSRFToken,
	getCSRFTokenFromCookie,
	onCSRFTokenRefresh,
} from "./utils/csrf"
import { logger } from "./utils/logger"
import { offlineWorker } from "./utils/offline/workerClient"
import translationPlugin from "./utils/translation"

import {
	Alert,
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	Input,
	TextInput,
	frappeRequest,
	pageMetaPlugin,
	resourcesPlugin,
	setConfig,
} from "frappe-ui"

import "./index.css"

const log = logger.create("Main")

// =============================================================================
// PWA Service Worker Registration
// =============================================================================

if ("serviceWorker" in navigator) {
	window.addEventListener(
		"load",
		() => {
			navigator.serviceWorker
				.register("/assets/pos_next/pos/sw.js", { scope: "/" })
				.then((reg) => {
					log.info("Service Worker registered successfully", reg)
					// Auto update logic
					reg.addEventListener("updatefound", () => {
						const newWorker = reg.installing
						if (newWorker) {
							newWorker.addEventListener("statechange", () => {
								if (
									newWorker.state === "installed" &&
									navigator.serviceWorker.controller
								) {
									log.info("New content available, reloading...")
									// Note: VitePWA autoUpdate will handle the actual skipWaiting automatically
									// if generateSW autoUpdate is true in vite.config.js,
									// but we can also manually reload if needed.
								}
							})
						}
					})
				})
				.catch((err) => {
					log.error("Service Worker registration error", err)
				})
		},
		{ passive: true },
	)
}

// =============================================================================
// Global Components (available in all templates without import)
// =============================================================================

const globalComponents = {
	Button,
	TextInput,
	Input,
	FormControl,
	ErrorMessage,
	Dialog,
	Alert,
	Badge,
}

// =============================================================================
// CSRF Token Management
// =============================================================================

/** Sync CSRF token to offline worker for authenticated API calls */
async function syncCSRFTokenToWorker() {
	if (window.csrf_token && typeof window.csrf_token === "string") {
		try {
			await offlineWorker.setCSRFToken(window.csrf_token)
			log.debug("CSRF token synced to worker")
		} catch (error) {
			log.warn("Failed to sync CSRF token to worker", error)
		}
	}
}

// =============================================================================
// Application Initialization
// =============================================================================

async function initializeApp() {
	const app = createApp(App)
	const pinia = createPinia()

	// Keep worker in sync when CSRF token refreshes
	onCSRFTokenRefresh((newToken) => {
		offlineWorker.setCSRFToken(newToken).catch((error) => {
			log.warn("Failed to sync refreshed CSRF token to worker", error)
		})
	})

	// Enable automatic CSRF token refresh on 401/403 errors
	const csrfAwareFrappeRequest = createCSRFAwareRequest(frappeRequest)
	setConfig("resourceFetcher", csrfAwareFrappeRequest)

	// Register plugins
	app.use(pinia)
	app.use(resourcesPlugin)
	app.use(pageMetaPlugin)
	app.use(translationPlugin)

	// Register global components
	for (const key in globalComponents) {
		app.component(key, globalComponents[key])
	}

	// Disable double-tap zoom on mobile for faster touch response
	app.directive("touch-action", {
		mounted: (el) => (el.style.touchAction = "manipulation"),
	})

	// -------------------------------------------------------------------------
	// Authentication (CSRF + User fetched in parallel for faster startup)
	// -------------------------------------------------------------------------

	const csrfPromise = (async () => {
		const existingToken = getCSRFTokenFromCookie()
		if (existingToken) {
			log.debug("CSRF token found in cookie")
			await syncCSRFTokenToWorker()
			return true
		}

		log.debug("Fetching CSRF token...")
		try {
			await ensureCSRFToken({ silent: true })
			await syncCSRFTokenToWorker()
			return true
		} catch {
			log.debug("CSRF fetch failed, will retry on first API call")
			return false
		}
	})()

	const userPromise = (async () => {
		try {
			if (!userResource.loading) {
				userResource
					.fetch()
					.catch((e) => log.debug("User fetch network rejected:", e?.message))
			}
			await userResource.promise
			return sessionUser()
		} catch (error) {
			log.debug(
				"User fetch failed (offline or logged out), falling back to cookie",
				error?.message,
			)
			return sessionUser()
		}
	})()

	const [, user] = await Promise.all([csrfPromise, userPromise])
	session.user = user
	log.info(`User authenticated: ${session.user}`)

	// -------------------------------------------------------------------------
	// Bootstrap Preload (non-blocking, improves perceived performance)
	// -------------------------------------------------------------------------

	if (user) {
		import("./stores/bootstrap")
			.then(async ({ useBootstrapStore }) => {
				const bootstrapStore = useBootstrapStore()
				try {
					await bootstrapStore.loadInitialData()
					// Initialize precision settings from bootstrap data
					const { initPrecision } = await import("./utils/currency")
					initPrecision(bootstrapStore.getPreloadedPrecision())
					log.debug("Precision settings initialized from bootstrap")
				} catch (error) {
					log.debug("Bootstrap preload failed (non-critical)", error)
				}
			})
			.catch(() => {})
	}

	// -------------------------------------------------------------------------
	// Mount Application
	// -------------------------------------------------------------------------

	log.debug("Registering router, auth state:", session.isLoggedIn)
	app.use(router)
	app.mount("#app")

	// -------------------------------------------------------------------------
	// Scheduled CSRF Token Refresh (every 30 minutes)
	// -------------------------------------------------------------------------

	setInterval(
		async () => {
			log.debug("Scheduled CSRF token refresh")
			await ensureCSRFToken({ forceRefresh: true, silent: true })
			await syncCSRFTokenToWorker()
		},
		30 * 60 * 1000,
	)
}

// Top-level guard: if Vue fails to initialize for any reason (missing globals,
// chunk load error, etc.) show a minimal retry UI instead of a blank screen.
initializeApp().catch((error) => {
	console.error("Fatal: POS app initialization failed", error)

	const el = document.getElementById("app")
	if (!el) return

	el.innerHTML = `
		<div style="
			display:flex; flex-direction:column; align-items:center;
			justify-content:center; height:100vh; font-family:sans-serif;
			background:#F9FAFB; color:#111827; text-align:center; padding:24px;
		">
			<svg width="48" height="48" fill="none" stroke="#6B7280" stroke-width="1.5"
				viewBox="0 0 24 24" style="margin-bottom:16px;">
				<path stroke-linecap="round" stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
					2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697
					16.126ZM12 15.75h.007v.008H12v-.008Z"/>
			</svg>
			<h2 style="margin:0 0 8px; font-size:18px; font-weight:600;">
				POS gagal memuat
			</h2>
			<p style="margin:0 0 24px; color:#6B7280; font-size:14px; max-width:320px;">
				Server mungkin sedang tidak tersedia. Data transaksi Anda tetap aman.
			</p>
			<button
				onclick="location.reload()"
				style="
					padding:10px 28px; background:#4F46E5; color:#fff;
					border:none; border-radius:8px; font-size:14px;
					font-weight:600; cursor:pointer; letter-spacing:.01em;
				">
				Coba Lagi
			</button>
		</div>
	`
})

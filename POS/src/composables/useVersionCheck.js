import { onMounted, onUnmounted, ref } from "vue"
import { logger } from "@/utils/logger"

const log = logger.create("VersionCheck")

const VERSION_URL = "/api/method/pos_next.api.utilities.get_app_build_info"
const CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

// Build version baked into this bundle at compile time (see vite.config.js).
// Stays constant for the lifetime of the loaded JS — even if served from a
// stale cache — which is exactly what makes it useful for detecting drift
// against whatever the server currently has deployed.
const CURRENT_BUILD_VERSION =
	typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : null

// Module-level state so every component that calls this composable shares
// the same poller and the same "update required" signal.
const updateRequired = ref(false)
const serverBuildVersion = ref(null)
let pollIntervalId = null
let listenerCount = 0

async function checkForUpdate() {
	if (!CURRENT_BUILD_VERSION || updateRequired.value) return

	try {
		const response = await fetch(VERSION_URL, {
			method: "GET",
			cache: "no-store",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token || "" },
		})
		if (!response.ok) return

		const data = await response.json()
		const buildVersion = data?.message?.build_version
		if (!buildVersion) return

		serverBuildVersion.value = buildVersion
		if (buildVersion !== CURRENT_BUILD_VERSION) {
			log.info(
				`New build detected (current: ${CURRENT_BUILD_VERSION}, server: ${buildVersion}) — update required`,
			)
			updateRequired.value = true
		}
	} catch (error) {
		// Network hiccups shouldn't trigger false positives — just retry next tick
		log.debug("Version check failed (will retry):", error?.message)
	}
}

function startPolling() {
	if (pollIntervalId) return
	checkForUpdate()
	pollIntervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS)

	document.addEventListener("visibilitychange", handleVisibilityChange)
}

function stopPolling() {
	if (pollIntervalId) {
		clearInterval(pollIntervalId)
		pollIntervalId = null
	}
	document.removeEventListener("visibilitychange", handleVisibilityChange)
}

function handleVisibilityChange() {
	if (document.visibilityState === "visible") {
		checkForUpdate()
	}
}

/**
 * Clears every layer of cached frontend assets (Cache Storage + Service
 * Worker registrations) and forces a hard reload, so the browser is
 * guaranteed to fetch the newly deployed build instead of a stale one.
 */
async function performHardRefresh() {
	try {
		if ("caches" in window) {
			const keys = await caches.keys()
			await Promise.all(keys.map((key) => caches.delete(key)))
		}
	} catch (error) {
		log.warn("Failed to clear cache storage:", error)
	}

	try {
		if ("serviceWorker" in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations()
			await Promise.all(registrations.map((reg) => reg.unregister()))
		}
	} catch (error) {
		log.warn("Failed to unregister service workers:", error)
	}

	window.location.reload()
}

export function useVersionCheck() {
	onMounted(() => {
		listenerCount++
		startPolling()
	})

	onUnmounted(() => {
		listenerCount--
		if (listenerCount <= 0) {
			stopPolling()
		}
	})

	return {
		updateRequired,
		serverBuildVersion,
		currentBuildVersion: CURRENT_BUILD_VERSION,
		checkForUpdate,
		performHardRefresh,
	}
}

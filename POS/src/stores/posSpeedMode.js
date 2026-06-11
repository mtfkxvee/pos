/**
 * POS Speed Mode Store
 *
 * "Speed Mode" is a managed offline mode that lets the cashier check out without
 * waiting for server round-trips. It builds entirely on the existing manual
 * offline toggle (offlineState/offlineWorker) and offline sync (posSync) — this
 * store only adds the on/off state, the per-shift transaction counter, and the
 * auto-sync orchestration.
 *
 * State is in-memory only (no localStorage/IndexedDB persistence) and resets
 * whenever the open shift changes, per the feature spec.
 *
 * @module stores/posSpeedMode
 */

import { shiftState } from "@/composables/useShift"
import { useToast } from "@/composables/useToast"
import {
	cacheItemsIncremental,
	cacheCustomersIncremental,
} from "@/utils/offline"
import { logger } from "@/utils/logger"
import { call } from "@/utils/apiWrapper"
import { offlineWorker } from "@/utils/offline/workerClient"
import { usePOSOffersStore } from "./posOffers"
import { usePOSSyncStore } from "./posSync"
import { defineStore } from "pinia"
import { ref, watch } from "vue"

const log = logger.create("SpeedMode")

const AUTO_SYNC_THRESHOLD = 10
const SERVER_CHECK_TIMEOUT_MS = 5000
const SERVER_CHECK_RETRY_DELAY_MS = 30000

/**
 * Lightweight, one-off connectivity check (independent of offlineState's
 * ping loop, which pauses while manual offline / Speed Mode is on).
 */
async function isServerReachable() {
	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(
			() => controller.abort(),
			SERVER_CHECK_TIMEOUT_MS,
		)
		const response = await fetch("/api/method/pos_next.api.ping", {
			method: "GET",
			signal: controller.signal,
			cache: "no-store",
			headers: { "Cache-Control": "no-cache" },
		})
		clearTimeout(timeoutId)
		return response.ok
	} catch {
		return false
	}
}

/**
 * Best-effort report of an auto-sync failure to the server Error Log so it
 * can be diagnosed without access to the cashier's browser console.
 */
async function reportSyncError(error, stage, posProfile) {
	try {
		await call("pos_next.api.utilities.log_client_error", {
			title: "Speed Mode Auto-Sync Error",
			message: error?.message || String(error),
			context: {
				stage,
				pos_profile: posProfile,
				stack: error?.stack,
			},
		})
	} catch (reportError) {
		log.error("Failed to report Speed Mode sync error", reportError)
	}
}

export const useSpeedModeStore = defineStore("posSpeedMode", () => {
	const { showWarning } = useToast()

	const isActive = ref(false)
	const isSyncing = ref(false)
	const transactionCount = ref(0)
	/** Human-readable label for the auto-sync step currently in progress (shown next to the toggle) */
	const syncStage = ref("")

	// Pending retry timer when the server was unreachable at sync time.
	let retryTimer = null

	function activate() {
		isActive.value = true
		offlineWorker.setManualOffline(true)
	}

	function deactivate() {
		isActive.value = false
		offlineWorker.setManualOffline(false)
	}

	function reset() {
		if (retryTimer) {
			clearTimeout(retryTimer)
			retryTimer = null
		}
		isActive.value = false
		isSyncing.value = false
		transactionCount.value = 0
		syncStage.value = ""
	}

	/**
	 * Call after a sale has been fully saved (and printed, if auto-print is on).
	 * Increments the per-shift counter and triggers a background sync once the
	 * threshold is reached.
	 */
	async function recordTransaction(posProfile) {
		if (!isActive.value) return

		transactionCount.value++
		if (transactionCount.value >= AUTO_SYNC_THRESHOLD && !isSyncing.value) {
			await runAutoSync(posProfile)
		}
	}

	/**
	 * Flush pending offline invoices and refresh item/customer caches
	 * incrementally, then silently switch back to Speed Mode.
	 */
	async function runAutoSync(posProfile, isRetry = false) {
		if (retryTimer) {
			clearTimeout(retryTimer)
			retryTimer = null
		}

		isSyncing.value = true
		syncStage.value = __("Checking connection...")

		// Check the server is actually reachable before going online -
		// offlineWorker.setManualOffline(false) alone doesn't guarantee the
		// device has connectivity, and starting the sync flow while offline
		// would just fail silently.
		const reachable = await isServerReachable()
		if (!reachable) {
			if (!isRetry) {
				showWarning(
					__("Server unreachable - {0} transaction(s) pending sync, will retry shortly", [
						transactionCount.value,
					]),
				)
			}
			syncStage.value = __("Waiting for connection...")
			retryTimer = setTimeout(() => {
				runAutoSync(posProfile, true)
			}, SERVER_CHECK_RETRY_DELAY_MS)
			return
		}

		const posSyncStore = usePOSSyncStore()
		const offersStore = usePOSOffersStore()
		let stage = ""

		try {
			// Go online in the background so pending invoices/customers can sync
			// and new transactions during this window go through normally.
			stage = syncStage.value = __("Going online...")
			offlineWorker.setManualOffline(false)

			// offlineState change notifications are debounced (150ms), so
			// posSyncStore.isOffline doesn't flip to false immediately - wait
			// for it to settle before syncing, otherwise syncAllPending() sees
			// the stale "offline" value and bails out without syncing anything.
			await new Promise((resolve) => setTimeout(resolve, 200))

			stage = syncStage.value = __("Syncing invoices...")
			await posSyncStore.syncAllPending()

			stage = syncStage.value = __("Updating items & customers...")
			const stats = await posSyncStore.getCacheStats()
			const [{ items }, { customers }] = await Promise.all([
				cacheItemsIncremental(posProfile, stats?.lastSync),
				cacheCustomersIncremental(posProfile, stats?.customersLastSync),
			])

			if (items?.length > 0) {
				await offlineWorker.cacheItems(items)
			}
			if (customers?.length > 0) {
				await offlineWorker.cacheCustomers(customers)
			}

			// Refresh promotions/offers
			stage = syncStage.value = __("Refreshing promotions...")
			offersStore.hasFetched = false
			await offersStore.ensureOffersFetched(posProfile)
		} catch (error) {
			// syncAllPending() / offlineState already handle retry + offline
			// fallback - report what failed so it can be diagnosed remotely.
			log.error(`Speed Mode auto-sync failed during "${stage}"`, error)
			showWarning(__('Sync failed during "{0}": {1}', [stage, error?.message || error]))
			await reportSyncError(error, stage, posProfile)
		} finally {
			// Back to Speed Mode regardless of sync outcome - the next 10
			// transactions will retry if anything was left pending.
			syncStage.value = __("Going back to Speed Mode...")
			offlineWorker.setManualOffline(true)
			transactionCount.value = 0
			isSyncing.value = false
			syncStage.value = ""
		}
	}

	// Speed Mode always starts OFF and resets whenever the open shift changes
	// (new shift opened, or current shift closed).
	watch(
		() => shiftState.value.pos_opening_shift,
		() => reset(),
	)

	return {
		isActive,
		isSyncing,
		transactionCount,
		syncStage,
		activate,
		deactivate,
		recordTransaction,
		reset,
	}
})

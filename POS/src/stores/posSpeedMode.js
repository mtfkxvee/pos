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
import {
	cacheItemsIncremental,
	cacheCustomersIncremental,
} from "@/utils/offline"
import { logger } from "@/utils/logger"
import { offlineWorker } from "@/utils/offline/workerClient"
import { usePOSOffersStore } from "./posOffers"
import { usePOSSyncStore } from "./posSync"
import { defineStore } from "pinia"
import { ref, watch } from "vue"

const log = logger.create("SpeedMode")

const AUTO_SYNC_THRESHOLD = 10

export const useSpeedModeStore = defineStore("posSpeedMode", () => {
	const isActive = ref(false)
	const isSyncing = ref(false)
	const transactionCount = ref(0)

	function activate() {
		isActive.value = true
		offlineWorker.setManualOffline(true)
	}

	function deactivate() {
		isActive.value = false
		offlineWorker.setManualOffline(false)
	}

	function reset() {
		isActive.value = false
		isSyncing.value = false
		transactionCount.value = 0
	}

	/**
	 * Call after a sale has been fully saved (and printed, if auto-print is on).
	 * Increments the per-shift counter and triggers a background sync once the
	 * threshold is reached.
	 */
	async function recordTransaction(posProfile) {
		if (!isActive.value) return

		transactionCount.value++
		if (transactionCount.value >= AUTO_SYNC_THRESHOLD) {
			await runAutoSync(posProfile)
		}
	}

	/**
	 * Flush pending offline invoices and refresh item/customer caches
	 * incrementally, then silently switch back to Speed Mode.
	 */
	async function runAutoSync(posProfile) {
		isSyncing.value = true
		const posSyncStore = usePOSSyncStore()
		const offersStore = usePOSOffersStore()

		try {
			// Go online in the background so pending invoices/customers can sync
			// and new transactions during this window go through normally.
			offlineWorker.setManualOffline(false)

			// offlineState change notifications are debounced (150ms), so
			// posSyncStore.isOffline doesn't flip to false immediately - wait
			// for it to settle before syncing, otherwise syncAllPending() sees
			// the stale "offline" value and bails out without syncing anything.
			await new Promise((resolve) => setTimeout(resolve, 200))

			await posSyncStore.syncAllPending()

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
			offersStore.hasFetched = false
			await offersStore.ensureOffersFetched(posProfile)
		} catch (error) {
			// syncAllPending() / offlineState already handle retry + offline
			// fallback - nothing extra to do here.
			log.error("Speed Mode auto-sync failed", error)
		} finally {
			// Back to Speed Mode regardless of sync outcome - the next 10
			// transactions will retry if anything was left pending.
			offlineWorker.setManualOffline(true)
			transactionCount.value = 0
			isSyncing.value = false
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
		activate,
		deactivate,
		recordTransaction,
		reset,
	}
})

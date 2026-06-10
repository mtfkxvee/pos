/**
 * Speed Mode pre-activation readiness check.
 *
 * Verifies that everything Speed Mode needs to operate offline (item catalog,
 * customers, promotions/offers, payment methods) is already cached locally.
 * Reuses the existing offline cache stats/helpers - no new caching logic.
 */

import { usePOSSyncStore } from "@/stores/posSync"
import { usePOSOffersStore } from "@/stores/posOffers"
import { useItemSearchStore } from "@/stores/itemSearch"
import { getCachedPaymentMethods } from "@/utils/offline"

export async function getSpeedModeReadiness(posProfile) {
	const posSyncStore = usePOSSyncStore()
	const offersStore = usePOSOffersStore()
	const itemStore = useItemSearchStore()

	const stats = await posSyncStore.getCacheStats()
	const paymentMethods = await getCachedPaymentMethods(posProfile)

	const missing = []
	if (!stats?.cacheReady || !stats?.items) missing.push(__("Item catalog"))
	if (!stats?.customers) missing.push(__("Customer list"))
	if (!offersStore.hasFetched) missing.push(__("Promotions / price rules"))
	if (!paymentMethods?.length) missing.push(__("Payment methods"))

	// Item catalog must be 100% downloaded before allowing offline-only checkout -
	// a partial catalog would mean items are unexpectedly "not found" while offline.
	const syncProgress = itemStore.cacheStats?.syncProgress
	if (itemStore.cacheSyncing || (syncProgress != null && syncProgress < 100)) {
		missing.push(
			syncProgress != null
				? __("Item catalog sync in progress ({0}%)", [syncProgress])
				: __("Item catalog sync in progress"),
		)
	}

	return { ready: missing.length === 0, missing }
}

/**
 * Static feature inventory shown in the Speed Mode activation dialog.
 */
export const SPEED_MODE_WORKS = [
	__(
		"Cart, item search/scan, and checkout with any payment method (Cash, Debit, Transfer)",
	),
	__("Customer search and creating new customers"),
	__("Promotions and discounts, including the Member discount"),
	__("Invoice History and viewing invoice details"),
	__("Returns for previously viewed/cached invoices"),
	__("Receipt printing"),
]

export const SPEED_MODE_DOES_NOT_WORK = [
	__("Selling items not already in the offline cache"),
	__("Real-time stock levels from other terminals"),
	__("Server-side pricing-rule edge cases not present in cached offers"),
	__("Viewing invoices that aren't cached locally"),
]

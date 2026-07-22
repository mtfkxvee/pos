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

	const syncProgress = itemStore.cacheStats?.syncProgress
	const catalogSyncing =
		itemStore.cacheSyncing || (syncProgress != null && syncProgress < 100)

	const checks = []

	// Item catalog — can be "syncing" (still downloading) or "missing" (never cached)
	if (catalogSyncing) {
		checks.push({
			key: "items",
			label: __("Katalog barang"),
			status: "syncing",
			progress: syncProgress,
		})
	} else if (!stats?.cacheReady || !stats?.items) {
		checks.push({ key: "items", label: __("Katalog barang"), status: "missing" })
	} else {
		checks.push({ key: "items", label: __("Katalog barang"), status: "ok" })
	}

	checks.push({
		key: "customers",
		label: __("Daftar pelanggan"),
		status: stats?.customers ? "ok" : "missing",
	})
	checks.push({
		key: "offers",
		label: __("Promo / aturan harga"),
		status: offersStore.hasFetched ? "ok" : "missing",
	})
	checks.push({
		key: "payments",
		label: __("Metode pembayaran"),
		status: paymentMethods?.length ? "ok" : "missing",
	})

	const ready = checks.every((c) => c.status === "ok")
	const missing = checks.filter((c) => c.status !== "ok").map((c) => c.label)

	return { ready, missing, checks }
}

/**
 * Static feature inventory shown in the Speed Mode activation dialog.
 */
export const SPEED_MODE_WORKS = [
	__(
		"Keranjang, pencarian/scan barang, dan pembayaran dengan metode apa pun (Tunai, Debit, Transfer)",
	),
	__("Pencarian pelanggan dan membuat pelanggan baru"),
	__("Promo dan diskon, termasuk diskon Member"),
	__("Riwayat Invoice dan melihat detail invoice"),
	__("Retur untuk invoice yang sudah pernah dilihat/tersimpan"),
	__("Cetak struk"),
]

export const SPEED_MODE_DOES_NOT_WORK = [
	__("Menjual barang yang belum ada di cache offline"),
	__("Stok real-time dari terminal lain"),
	__("Aturan harga khusus server yang tidak ada di cache promo"),
	__("Melihat invoice yang tidak tersimpan secara lokal"),
]

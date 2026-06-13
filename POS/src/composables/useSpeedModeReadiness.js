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
	if (!stats?.cacheReady || !stats?.items) missing.push(__("Katalog barang"))
	if (!stats?.customers) missing.push(__("Daftar pelanggan"))
	if (!offersStore.hasFetched) missing.push(__("Promo / aturan harga"))
	if (!paymentMethods?.length) missing.push(__("Metode pembayaran"))

	// Item catalog must be 100% downloaded before allowing offline-only checkout -
	// a partial catalog would mean items are unexpectedly "not found" while offline.
	const syncProgress = itemStore.cacheStats?.syncProgress
	if (itemStore.cacheSyncing || (syncProgress != null && syncProgress < 100)) {
		missing.push(
			syncProgress != null
				? __("Sinkronisasi katalog barang sedang berjalan ({0}%)", [syncProgress])
				: __("Sinkronisasi katalog barang sedang berjalan"),
		)
	}

	return { ready: missing.length === 0, missing }
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

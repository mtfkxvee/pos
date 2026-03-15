import { db } from "./db"
import { logger } from "@/utils/logger"

const log = logger.create("Backup")
const BACKUP_KEY = "pos_offline_invoice_backup"

/**
 * Rebuild the localStorage snapshot from the current pending invoice queue.
 * Called automatically after every save / delete / sync operation.
 * Silent-fails if localStorage is full or unavailable.
 */
export async function saveLocalStorageMirror() {
	try {
		const pending = await db.invoice_queue.filter((inv) => !inv.synced).toArray()
		const backup = {
			version: 1,
			saved_at: Date.now(),
			invoices: pending.map((inv) => ({
				offline_id: inv.offline_id,
				timestamp: inv.timestamp,
				data: inv.data,
			})),
		}
		localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
		log.info(`localStorage mirror updated: ${pending.length} pending invoice(s)`)
	} catch (err) {
		// localStorage quota exceeded or unavailable — ignore silently
		log.warn("Failed to update localStorage mirror", err)
	}
}

/**
 * Trigger a JSON file download containing all currently pending invoices.
 * @param {Array} pendingInvoices - Array of invoice queue records
 */
export function exportBackupToFile(pendingInvoices) {
	const exportData = {
		version: 1,
		exported_at: new Date().toISOString(),
		app: "NURSA POS",
		type: "pos_offline_backup",
		invoices: pendingInvoices.map((inv) => ({
			offline_id: inv.offline_id,
			timestamp: inv.timestamp,
			data: inv.data,
		})),
	}

	const blob = new Blob([JSON.stringify(exportData, null, 2)], {
		type: "application/json",
	})
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	const dateStr = new Date().toISOString().replace(/:/g, "-").substring(0, 19)
	a.download = `pos_backup_${dateStr}.json`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
	log.info(`Exported ${pendingInvoices.length} invoice(s) to file`)
}

/**
 * Import invoices from a backup JSON file and re-queue any missing ones.
 * Deduplicates by offline_id so it is safe to import the same file multiple times.
 * @param {File} file - The JSON backup file to import
 * @returns {Promise<{restored: number, skipped: number}>}
 */
export async function importBackupFromFile(file) {
	const text = await file.text()
	const parsed = JSON.parse(text)

	if (parsed.type !== "pos_offline_backup") {
		throw new Error("Invalid backup file format")
	}

	const invoices = parsed.invoices || []
	let restored = 0
	let skipped = 0

	for (const inv of invoices) {
		if (!inv.offline_id) {
			skipped++
			continue
		}
		const existing = await db.invoice_queue
			.where("offline_id")
			.equals(inv.offline_id)
			.first()

		if (!existing) {
			await db.invoice_queue.add({
				offline_id: inv.offline_id,
				data: inv.data,
				timestamp: inv.timestamp || Date.now(),
				synced: false,
				retry_count: 0,
				sync_failed: false,
			})
			restored++
		} else {
			skipped++
		}
	}

	// Refresh the mirror after import
	await saveLocalStorageMirror()
	log.info(`Import complete: ${restored} restored, ${skipped} skipped`)
	return { restored, skipped }
}

/**
 * Read the localStorage backup and return the invoice count (for info display).
 * Returns 0 if no backup exists.
 */
export function getLocalStorageBackupCount() {
	try {
		const raw = localStorage.getItem(BACKUP_KEY)
		if (!raw) return 0
		const parsed = JSON.parse(raw)
		return parsed.invoices?.length || 0
	} catch {
		return 0
	}
}

/**
 * Check if localStorage has a backup with invoices while IndexedDB queue is empty.
 * Used on app startup to detect possible data loss and offer recovery.
 * @returns {Promise<{hasOrphaned: boolean, count: number, backup: Object|null}>}
 */
export async function checkOrphanedLocalStorageBackup() {
	try {
		const raw = localStorage.getItem(BACKUP_KEY)
		if (!raw) return { hasOrphaned: false, count: 0, backup: null }

		const backup = JSON.parse(raw)
		const backupCount = backup.invoices?.length || 0
		if (backupCount === 0) return { hasOrphaned: false, count: 0, backup: null }

		const dbCount = await db.invoice_queue.filter((inv) => !inv.synced).count()
		const hasOrphaned = dbCount === 0 && backupCount > 0

		return { hasOrphaned, count: backupCount, backup }
	} catch {
		return { hasOrphaned: false, count: 0, backup: null }
	}
}

/**
 * Restore invoices from the localStorage backup into IndexedDB.
 * Called when hasOrphaned is true (e.g. IndexedDB was cleared/corrupted).
 * @returns {Promise<{restored: number, skipped: number}>}
 */
export async function restoreFromLocalStorageBackup() {
	try {
		const raw = localStorage.getItem(BACKUP_KEY)
		if (!raw) return { restored: 0, skipped: 0 }

		const backup = JSON.parse(raw)
		const invoices = backup.invoices || []
		let restored = 0
		let skipped = 0

		for (const inv of invoices) {
			if (!inv.offline_id) {
				skipped++
				continue
			}
			const existing = await db.invoice_queue
				.where("offline_id")
				.equals(inv.offline_id)
				.first()
			if (!existing) {
				await db.invoice_queue.add({
					offline_id: inv.offline_id,
					data: inv.data,
					timestamp: inv.timestamp || Date.now(),
					synced: false,
					retry_count: 0,
					sync_failed: false,
				})
				restored++
			} else {
				skipped++
			}
		}

		log.info(`Restored from localStorage: ${restored} restored, ${skipped} skipped`)
		return { restored, skipped }
	} catch (err) {
		log.error("Failed to restore from localStorage backup", err)
		return { restored: 0, skipped: 0 }
	}
}

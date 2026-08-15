/**
 * WebUSB ESC/POS printer utility — supports two independent USB printers:
 *   1. Receipt printer (struk kasir) → pos_usb_printer_receipt
 *   2. Label printer  (cup labels)  → pos_usb_printer_label
 *
 * Windows requirement: replace the printer's USB driver with WinUSB via
 * Zadig (https://zadig.akeo.ie/) before the browser can claim the interface.
 */

import { buildReceiptData } from "@/utils/bluetoothPrinter"
import { call } from "frappe-ui"

const STORAGE_KEY_RECEIPT = "pos_usb_printer_receipt"
const STORAGE_KEY_LABEL = "pos_usb_printer_label"
const STORAGE_KEY_LEGACY = "pos_usb_printer"

// Migrate old single-printer data to label slot (one-time, at module load)
;(function _migrate() {
	try {
		const old = localStorage.getItem(STORAGE_KEY_LEGACY)
		if (old && !localStorage.getItem(STORAGE_KEY_LABEL)) {
			localStorage.setItem(STORAGE_KEY_LABEL, old)
		}
	} catch {}
})()

// ── Public query helpers ──────────────────────────────────────────────────────

export function isUSBAvailable() {
	return !!navigator?.usb
}

function _readStorage(key) {
	try {
		const raw = localStorage.getItem(key)
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

export function getUSBReceiptPrinterName() {
	return _readStorage(STORAGE_KEY_RECEIPT)?.name ?? null
}

export function getUSBLabelPrinterName() {
	return _readStorage(STORAGE_KEY_LABEL)?.name ?? null
}

/** Backward-compat alias for label printer */
export function getUSBPrinterName() {
	return getUSBLabelPrinterName()
}

// ── Device state ─────────────────────────────────────────────────────────────

const _receipt = { device: null, epNum: null }
const _label = { device: null, epNum: null }

// ── Access-denied error message ───────────────────────────────────────────────

const ZADIG_MSG =
	"Akses ditolak (Access denied). Di Windows: uninstall driver printer di Device Manager, " +
	"lalu install WinUSB via Zadig (zadig.akeo.ie), kemudian pair ulang."

// ── Low-level USB helpers ─────────────────────────────────────────────────────

async function _openAndClaim(device) {
	try {
		if (!device.opened) await device.open()
	} catch (err) {
		const msg = (err?.message || "").toLowerCase()
		if (msg.includes("access denied") || msg.includes("access_denied")) {
			throw new Error(ZADIG_MSG)
		}
		throw err
	}

	try {
		if (device.configuration === null) await device.selectConfiguration(1)
	} catch {
		// Some devices don't need explicit configuration selection — ignore
	}

	let lastClaimErr = null
	for (const pass of ["printer", "any"]) {
		for (const iface of device.configuration.interfaces) {
			for (const alt of iface.alternates) {
				if (pass === "printer" && alt.interfaceClass !== 0x07) continue
				for (const ep of alt.endpoints) {
					if (ep.direction !== "out" || ep.type !== "bulk") continue
					try {
						await device.claimInterface(iface.interfaceNumber)
						return ep.endpointNumber
					} catch (err) {
						lastClaimErr = err
					}
				}
			}
		}
	}

	const claimMsg = (lastClaimErr?.message || "").toLowerCase()
	if (claimMsg.includes("access denied") || claimMsg.includes("access_denied")) {
		throw new Error(ZADIG_MSG)
	}
	throw new Error(
		"Tidak ditemukan endpoint bulk OUT yang bisa diklaim. " +
		"Pastikan printer sudah terhubung dan driver WinUSB sudah terpasang via Zadig.",
	)
}

async function _transfer(slot, data) {
	const CHUNK = 4096
	for (let i = 0; i < data.length; i += CHUNK) {
		await slot.device.transferOut(slot.epNum, data.slice(i, i + CHUNK))
	}
}

// Raw USB bypasses OS driver which normally converts LF → CRLF.
// ESC/POS printers need explicit CR+LF to flush each line.
function _addCR(data) {
	const result = []
	for (const byte of data) {
		if (byte === 0x0A) result.push(0x0D)
		result.push(byte)
	}
	return new Uint8Array(result)
}

// ── Pairing ───────────────────────────────────────────────────────────────────

async function _pair(storageKey, slot) {
	const device = await navigator.usb.requestDevice({ filters: [{ classCode: 0x07 }] })
	const epNum = await _openAndClaim(device)
	slot.device = device
	slot.epNum = epNum
	const name = device.productName || device.manufacturerName || "USB Printer"
	localStorage.setItem(
		storageKey,
		JSON.stringify({ name, vendorId: device.vendorId, productId: device.productId }),
	)
	return name
}

export async function pairUSBReceiptPrinter() {
	return _pair(STORAGE_KEY_RECEIPT, _receipt)
}

export async function pairUSBLabelPrinter() {
	return _pair(STORAGE_KEY_LABEL, _label)
}

/** Backward-compat alias — pairs label printer */
export async function pairUSBPrinter() {
	return pairUSBLabelPrinter()
}

// ── Remove ────────────────────────────────────────────────────────────────────

function _remove(storageKey, slot) {
	localStorage.removeItem(storageKey)
	if (slot.device) {
		try { slot.device.close() } catch {}
	}
	slot.device = null
	slot.epNum = null
}

export function removeUSBReceiptPrinter() { _remove(STORAGE_KEY_RECEIPT, _receipt) }
export function removeUSBLabelPrinter() { _remove(STORAGE_KEY_LABEL, _label) }

/** Backward-compat alias */
export function removeUSBPrinter() { removeUSBLabelPrinter() }

// ── Connection ────────────────────────────────────────────────────────────────

async function _ensureConnected(storageKey, slot, label) {
	if (slot.device?.opened && slot.epNum !== null) return

	const stored = _readStorage(storageKey)
	if (!stored) throw new Error(`USB printer ${label} belum dipasangkan.`)

	const devices = await navigator.usb.getDevices()
	const device = devices.find(
		(d) => d.vendorId === stored.vendorId && d.productId === stored.productId,
	)
	if (!device) {
		throw new Error(
			`Printer USB ${label} tidak ditemukan. Pastikan kabel terhubung, lalu coba lagi atau pair ulang.`,
		)
	}
	slot.epNum = await _openAndClaim(device)
	slot.device = device
}

// ── Receipt print ─────────────────────────────────────────────────────────────

export async function printReceiptUSB(invoiceData) {
	await _ensureConnected(STORAGE_KEY_RECEIPT, _receipt, "struk")

	let totalLoyaltyPoints = null
	if (invoiceData.customer) {
		try {
			totalLoyaltyPoints = await call(
				"pos_next.api.customers.get_customer_loyalty_balance",
				{ customer: invoiceData.customer },
			)
		} catch { /* non-fatal */ }
	}

	const data = _addCR(buildReceiptData(invoiceData, totalLoyaltyPoints))
	await _transfer(_receipt, data)
}

// ── Label print ───────────────────────────────────────────────────────────────

function _buildLabelData(itemName, remarks) {
	const now = new Date()
	const hh = String(now.getHours()).padStart(2, "0")
	const mm = String(now.getMinutes()).padStart(2, "0")
	const safe = (s) => String(s || "").replace(/"/g, "'").replace(/[\r\n]/g, " ").trim()

	// Label: 60mm × 40mm at 8 dots/mm = 480 × 320 dots
	const LW = 480, LH = 320, M = 10

	// Blueprint printer applies an internal 180° rotation to the whole label.
	// Fix: send TEXT with rotation=180 and DIRECTION 0.
	//
	// With TEXT rotation=180, (x,y) is the text bottom-right in TSPL space.
	// After the printer's own 180° flip that becomes the physical top-left:
	//   physical_left = LW - x  →  x = LW - physLeft  (= LW-M = 470, CONSTANT)
	//   physical_top  = LH - y  →  y = LH - physTop
	// BAR has no rotation; same formula: TSPL_y = LH - physTop - height.

	const TX = LW - M  // 470 — constant TSPL X for all left-aligned text
	const truncItem = safe(itemName).substring(0, 19)

	const cmds = [
		"SIZE 60 mm,40 mm",
		"GAP 3 mm,0",
		"SPEED 3",
		"DENSITY 8",
		"DIRECTION 0,0",
		"CODEPAGE UTF-8",
		"CLS",
		// Header "X-Sha grow" — font "2" (24px tall) — physical top=8
		`TEXT ${TX},${LH - 8},"2",180,1,1,"X-Sha grow"`,
		// Divider — physical y=38, 2px tall
		`BAR 0,${LH - 38 - 2},${LW},2`,
		// Item — font "3" yMult=2 (48px tall) — physical top=42
		`TEXT ${TX},${LH - 42},"3",180,1,2,"${truncItem}"`,
	]

	// Remarks + time (item ends at physical y≈90)
	let physY = 98
	if (remarks?.trim()) {
		const rem = safe(remarks).substring(0, 26)
		cmds.push(`TEXT ${TX},${LH - physY},"1",180,1,1,"${rem}"`)
		physY += 28
	}
	cmds.push(`TEXT ${TX},${LH - physY},"2",180,1,1,"${hh}:${mm}"`)
	cmds.push("PRINT 1,1")

	return new TextEncoder().encode(cmds.join("\r\n") + "\r\n")
}

export async function printLabelUSB(itemName, remarks, copies = 1) {
	await _ensureConnected(STORAGE_KEY_LABEL, _label, "label")
	const data = _buildLabelData(itemName, remarks)
	for (let i = 0; i < copies; i++) {
		await _transfer(_label, data)
		if (copies > 1 && i < copies - 1) {
			await new Promise((r) => setTimeout(r, 200))
		}
	}
}

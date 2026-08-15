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
	const LW = 480, LH = 320

	// DIRECTION 0, rotation=0: characters are right-side-up.
	// Font "2" = 12px/char confirmed. Multipliers scale proportionally.
	// Center formula: cx = (LW - len*charW) / 2
	const FW2 = 12
	const cx = (w) => Math.max(0, Math.floor((LW - w) / 2))

	const hasRemarks = !!remarks?.trim()

	// Product name: font "2" xMult=2, yMult=3 → 24px wide × 60px tall (smaller than before)
	const itemCharW = FW2 * 2   // 24px per char
	const itemH = 60            // 20px × yMult=3
	const maxPerLine = Math.floor(LW / itemCharW)  // 20 chars per line

	// Word-wrap into max 2 lines
	const rawItem = safe(itemName)
	const itemLines = []
	let cur = ""
	for (const word of rawItem.split(" ")) {
		const w = word.substring(0, maxPerLine)
		if (!cur) {
			cur = w
		} else if ((cur + " " + w).length <= maxPerLine) {
			cur += " " + w
		} else {
			itemLines.push(cur)
			cur = w
			if (itemLines.length === 2) break
		}
	}
	if (cur && itemLines.length < 2) itemLines.push(cur)

	const lineGap = 4
	const remH = 20   // font "2" xMult=1 tall enough to read
	const remGap = 8

	// Total content block height
	const contentH = itemLines.length * itemH + (itemLines.length - 1) * lineGap
		+ (hasRemarks ? remGap + remH : 0)

	// Vertical centering in body area (header bottom≈34, time top≈286)
	const bodyTop = 34, bodyBottom = LH - 34
	const blockTop = Math.floor((bodyTop + bodyBottom - contentH) / 2)

	const cmds = [
		"SIZE 60 mm,40 mm",
		"GAP 3 mm,0",
		"SPEED 3",
		"DENSITY 8",
		"DIRECTION 0,0",
		"CODEPAGE UTF-8",
		"CLS",
		// Header — centered, font "2" (12px/char × 20px tall)
		`TEXT ${cx(10 * FW2)},8,"2",0,1,1,"X-Sha grow"`,
	]

	// Product name lines — each centered
	itemLines.forEach((line, i) => {
		cmds.push(`TEXT ${cx(line.length * itemCharW)},${blockTop + i * (itemH + lineGap)},"2",0,2,3,"${line}"`)
	})

	if (hasRemarks) {
		const rem = safe(remarks).substring(0, 40)
		const remY = blockTop + itemLines.length * (itemH + lineGap) - lineGap + remGap
		cmds.push(`TEXT ${cx(rem.length * FW2)},${remY},"2",0,1,1,"${rem}"`)
	}

	// Time at bottom-left
	cmds.push(`TEXT 10,${LH - 30},"2",0,1,1,"${hh}:${mm}"`)
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

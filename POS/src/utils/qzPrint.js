import qz from "qz-tray"
import { logger } from "@/utils/logger"

const log = logger.create("QZPrint")
const PRINTER_KEY = "pos_thermal_printer_name"

export function getStoredPrinterName() {
	return localStorage.getItem(PRINTER_KEY) || ""
}

export function setStoredPrinterName(name) {
	localStorage.setItem(PRINTER_KEY, name || "")
}

// Unsigned mode — QZ Tray will prompt "Allow unsigned" once per domain.
// After user clicks Allow in QZ Tray, it won't ask again for this domain.
function _setupSecurity() {
	qz.security.setCertificatePromise((resolve) => resolve())
	qz.security.setSignaturePromise((toSign) => (resolve) => resolve())
}

let _connectPromise = null

async function _ensureConnected() {
	if (qz.websocket.isActive()) return
	if (_connectPromise) return _connectPromise
	_connectPromise = qz.websocket
		.connect({ retries: 2, delay: 1 })
		.finally(() => {
			_connectPromise = null
		})
	return _connectPromise
}

/**
 * Print HTML content silently via QZ Tray.
 * Throws a descriptive error if QZ Tray is not running or printer is wrong.
 * @param {string} htmlContent - Full HTML string to render and print
 * @param {string} printerName - Windows printer name (exact match)
 * @param {number} paperWidthMm - 58 or 80
 */
export async function printHtml(htmlContent, printerName, paperWidthMm = 58) {
	_setupSecurity()

	try {
		await _ensureConnected()
	} catch (e) {
		throw new Error("QZ Tray tidak terdeteksi. Pastikan QZ Tray sudah diinstall dan berjalan di system tray.")
	}

	const printer = printerName || getStoredPrinterName()
	if (!printer) {
		throw new Error("Nama printer belum dikonfigurasi. Buka Settings → Printing dan isi Thermal Printer Name.")
	}

	// Strip no-print button block before sending to QZ Tray
	const cleanHtml = htmlContent.replace(
		/<div class="no-print"[\s\S]*?<\/div>/gi,
		"",
	)

	const config = qz.configs.create(printer, {
		colorType: "blackwhite",
		density: 203,
		size: { width: paperWidthMm, height: null },
		units: "mm",
		margins: 0,
	})

	try {
		await qz.print(config, [
			{
				type: "pixel",
				format: "html",
				flavor: "plain",
				data: cleanHtml,
			},
		])
		log.info("QZ Tray print successful →", printer)
	} catch (e) {
		log.error("QZ Tray print error:", e)
		// Give a more helpful error message
		const msg = String(e?.message || e || "")
		if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no printer")) {
			throw new Error(`Printer "${printer}" tidak ditemukan. Cek nama printer di Windows Devices & Printers.`)
		}
		throw e
	}
}

/**
 * List all printers available via QZ Tray (for settings UI autocomplete).
 */
export async function listPrinters() {
	_setupSecurity()
	await _ensureConnected()
	return qz.printers.find()
}

/**
 * Test if QZ Tray WebSocket can be reached.
 * Returns true/false — does NOT throw.
 */
export async function isQzAvailable() {
	try {
		_setupSecurity()
		await _ensureConnected()
		return qz.websocket.isActive()
	} catch {
		return false
	}
}

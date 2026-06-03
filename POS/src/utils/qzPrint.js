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
// For no-prompt production use, replace with a real signing certificate.
function _setupSecurity() {
	qz.security.setCertificatePromise((resolve) => resolve())
	qz.security.setSignaturePromise((toSign) => (resolve) => resolve())
}

let _connectPromise = null

async function _ensureConnected() {
	if (qz.websocket.isActive()) return
	if (_connectPromise) return _connectPromise
	_connectPromise = qz.websocket
		.connect({ retries: 1, delay: 0.5 })
		.finally(() => {
			_connectPromise = null
		})
	return _connectPromise
}

/**
 * Print HTML content silently via QZ Tray.
 * @param {string} htmlContent - Full HTML string to render and print
 * @param {string} printerName - Windows printer name (exact match)
 * @param {number} paperWidthMm - 58 or 80
 */
export async function printHtml(htmlContent, printerName, paperWidthMm = 58) {
	_setupSecurity()
	await _ensureConnected()

	const printer = printerName || getStoredPrinterName()
	if (!printer) {
		throw new Error("Nama printer belum dikonfigurasi. Buka Settings → Printing dan isi Thermal Printer Name.")
	}

	// Strip the no-print button block before sending to QZ Tray
	const cleanHtml = htmlContent.replace(
		/<div class="no-print"[\s\S]*?<\/div>/i,
		"",
	)

	const config = qz.configs.create(printer, {
		colorType: "blackwhite",
		density: 203, // typical thermal DPI
		size: { width: paperWidthMm, height: null },
		units: "mm",
		margins: 0,
	})

	await qz.print(config, [
		{
			type: "pixel",
			format: "html",
			flavor: "plain",
			data: cleanHtml,
		},
	])
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

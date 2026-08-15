/**
 * WebUSB ESC/POS printer utility — cup labels only.
 * Stores pairing info (vendorId, productId, name) in localStorage so the
 * browser can reconnect to the same device without showing the picker again.
 *
 * Windows requirement: the printer's USB driver must be replaced with WinUSB
 * via Zadig (https://zadig.akeo.ie/) before the browser can claim the interface.
 */

const STORAGE_KEY = "pos_usb_printer"

export function isUSBAvailable() {
	return !!navigator?.usb
}

export function getUSBPrinterName() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? JSON.parse(raw).name : null
	} catch {
		return null
	}
}

export function removeUSBPrinter() {
	localStorage.removeItem(STORAGE_KEY)
	if (_device) {
		try { _device.close() } catch {}
	}
	_device = null
	_epNum = null
}

// ── Internal connection state ──────────────────────────────────────────────

let _device = null
let _epNum = null

const ZADIG_MSG =
	"Akses ditolak (Access denied). Di Windows: uninstall driver printer di Device Manager, " +
	"lalu install WinUSB via Zadig (zadig.akeo.ie), kemudian pair ulang."

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

	// Try USB printer class (0x07) interfaces first, then any with a bulk OUT
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

// ── Public pairing API ─────────────────────────────────────────────────────

export async function pairUSBPrinter() {
	const device = await navigator.usb.requestDevice({
		filters: [{ classCode: 0x07 }],
	})
	const epNum = await _openAndClaim(device)
	_device = device
	_epNum = epNum
	const name =
		device.productName || device.manufacturerName || "USB Printer"
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({ name, vendorId: device.vendorId, productId: device.productId }),
	)
	return name
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function _ensureConnected() {
	if (_device?.opened && _epNum !== null) return

	const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
	if (!stored) throw new Error("USB printer belum dipasangkan.")

	const devices = await navigator.usb.getDevices()
	const device = devices.find(
		(d) => d.vendorId === stored.vendorId && d.productId === stored.productId,
	)
	if (!device) {
		throw new Error(
			"Printer USB tidak ditemukan. Pastikan kabel terhubung, lalu coba lagi atau pair ulang.",
		)
	}
	_epNum = await _openAndClaim(device)
	_device = device
}

async function _transfer(data) {
	const CHUNK = 4096
	for (let i = 0; i < data.length; i += CHUNK) {
		await _device.transferOut(_epNum, data.slice(i, i + CHUNK))
	}
}

function _buildLabelData(itemName, remarks) {
	const enc = new TextEncoder()
	const b = []
	const push = (...bytes) => b.push(...bytes)
	// Raw USB bypasses the Windows printer driver which normally converts \n → \r\n.
	// ESC/POS printers need explicit CR+LF to flush each line.
	const line = (s) => b.push(...enc.encode(s + "\r\n"))

	const now = new Date()
	const hh = String(now.getHours()).padStart(2, "0")
	const mm = String(now.getMinutes()).padStart(2, "0")

	push(0x1b, 0x40)       // init
	push(0x1b, 0x61, 0x01) // center
	push(0x1d, 0x21, 0x00) // normal size
	push(0x1b, 0x45, 0x00) // bold off
	line("X-Sha grow")
	line("--------------------------------")
	push(0x1d, 0x21, 0x11) // double height + width
	push(0x1b, 0x45, 0x01) // bold on
	line(itemName)
	push(0x1d, 0x21, 0x00) // normal
	push(0x1b, 0x45, 0x00) // bold off
	if (remarks?.trim()) line(remarks.trim())
	line(`${hh}:${mm}`)
	push(0x1b, 0x64, 0x03) // feed 3 lines

	return new Uint8Array(b)
}

// ── Public print API ───────────────────────────────────────────────────────

export async function printLabelUSB(itemName, remarks, copies = 1) {
	await _ensureConnected()
	const data = _buildLabelData(itemName, remarks)
	for (let i = 0; i < copies; i++) {
		await _transfer(data)
		if (copies > 1 && i < copies - 1) {
			await new Promise((r) => setTimeout(r, 200))
		}
	}
}

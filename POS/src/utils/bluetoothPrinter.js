// BLE thermal printer utility (58mm ESC/POS)
// Supports common Chinese 58mm BLE printers (iWare, etc.)
import { getCachedCompanyAddress } from "@/utils/offline/cache"

const STORAGE_KEY = "pos_bt_printer_name"

// Known BLE service/characteristic pairs for 58mm thermal printers
const KNOWN_SERVICES = [
	{
		service: "000018f0-0000-1000-8000-00805f9b34fb",
		characteristic: "00002af1-0000-1000-8000-00805f9b34fb",
	},
	{
		// Nordic UART Service (NUS) — used by many BLE printers
		service: "6e400001-b5b3-f393-e0a9-e50e24dcca9e",
		characteristic: "6e400002-b5b3-f393-e0a9-e50e24dcca9e",
	},
	{
		service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
		characteristic: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
	},
	{
		service: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
		characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3",
	},
]

let _device = null
let _characteristic = null

export function isBTAvailable() {
	return typeof navigator !== "undefined" && !!navigator.bluetooth
}

export function getBTPrinterName() {
	try {
		return localStorage.getItem(STORAGE_KEY) || null
	} catch {
		return null
	}
}

export function removeBTPrinter() {
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {}
	if (_device?.gatt?.connected) {
		try { _device.gatt.disconnect() } catch {}
	}
	_device = null
	_characteristic = null
}

// Called from a user-gesture (button click) to open browser BLE picker
export async function pairBTPrinter() {
	if (!isBTAvailable()) throw new Error("Web Bluetooth tidak didukung browser ini")

	const device = await navigator.bluetooth.requestDevice({
		acceptAllDevices: true,
		optionalServices: KNOWN_SERVICES.map((s) => s.service),
	})

	const char = await _connectDevice(device)
	if (!char) throw new Error("Printer tidak dikenali. Pastikan printer menyala dan dalam jangkauan.")

	_device = device
	_characteristic = char

	// Re-connect if device disconnects
	device.addEventListener("gattserverdisconnected", () => {
		_characteristic = null
	})

	const name = device.name || "Bluetooth Printer"
	try { localStorage.setItem(STORAGE_KEY, name) } catch {}
	return name
}

async function _connectDevice(device) {
	const server = await device.gatt.connect()

	for (const { service: svcUUID, characteristic: charUUID } of KNOWN_SERVICES) {
		try {
			const svc = await server.getPrimaryService(svcUUID)
			const char = await svc.getCharacteristic(charUUID)
			if (char.properties.write || char.properties.writeWithoutResponse) {
				return char
			}
		} catch {
			// service/char not present on this printer, try next
		}
	}
	return null
}

async function _ensureConnected() {
	// Already connected
	if (_device?.gatt?.connected && _characteristic) return _characteristic

	// Try to reuse previously granted device (Chrome 85+)
	if (!_device && navigator.bluetooth.getDevices) {
		const devices = await navigator.bluetooth.getDevices()
		const savedName = getBTPrinterName()
		const match = savedName
			? devices.find((d) => d.name === savedName) || devices[0]
			: devices[0]
		if (match) _device = match
	}

	if (!_device) throw new Error("Tidak ada printer yang dipasangkan. Buka Settings untuk pair printer.")

	_characteristic = await _connectDevice(_device)
	if (!_characteristic) throw new Error("Gagal konek ke printer. Pastikan printer menyala dan dalam jangkauan.")

	_device.addEventListener("gattserverdisconnected", () => {
		_characteristic = null
	})

	return _characteristic
}

// Chunk data to avoid BLE MTU limits
async function _writeChunked(char, data) {
	const CHUNK = 200
	const useResponse = char.properties.write
	for (let i = 0; i < data.length; i += CHUNK) {
		const chunk = data.slice(i, i + CHUNK)
		if (useResponse) {
			await char.writeValue(chunk)
		} else {
			await char.writeValueWithoutResponse(chunk)
		}
	}
}

// Print one label for an item
// copies: how many times to repeat this label
export async function printLabelBT(itemName, remarks, copies = 1) {
	const char = await _ensureConnected()
	const data = _buildLabel(itemName, remarks)
	for (let i = 0; i < copies; i++) {
		await _writeChunked(char, data)
		if (copies > 1 && i < copies - 1) {
			// Small delay between copies so printer buffer doesn't overflow
			await new Promise((r) => setTimeout(r, 300))
		}
	}
}

// ── Receipt printer ──────────────────────────────────────────────────────────

export async function printReceiptBT(invoiceData) {
	const char = await _ensureConnected()
	const data = _buildReceipt(invoiceData)
	await _writeChunked(char, data)
}

const COLS = 32 // chars per line for 58mm standard font

function _num(val) {
	const v = Math.floor(val || 0)
	if (v >= 1_000_000) return `${Math.floor(v / 1_000_000)}.${String(Math.floor((v % 1_000_000) / 1_000)).padStart(3, "0")}.${String(v % 1_000).padStart(3, "0")}`
	if (v >= 1_000) return `${Math.floor(v / 1_000)}.${String(v % 1_000).padStart(3, "0")}`
	return `${v}`
}

// Left label, right-aligned value, padded to COLS
function _row(label, value, cols = COLS) {
	const safe = label.substring(0, cols - value.length - 1)
	const spaces = Math.max(1, cols - safe.length - value.length)
	return safe + " ".repeat(spaces) + value
}

// Center text within cols
function _center(str, cols = COLS) {
	const pad = Math.max(0, Math.floor((cols - str.length) / 2))
	return " ".repeat(pad) + str
}

function _buildReceipt(inv) {
	const enc = new TextEncoder()
	const b = []
	const push = (...bytes) => b.push(...bytes)
	const line = (str = "") => b.push(...enc.encode(str.substring(0, COLS) + "\n"))
	const sep = (char = "-") => line(char.repeat(COLS))

	const fmtDate = (d) => {
		if (!d) return ""
		const dd = String(d.getDate()).padStart(2, "0")
		const mm = String(d.getMonth() + 1).padStart(2, "0")
		return `${dd}-${mm}-${d.getFullYear()}`
	}

	// Init
	push(0x1b, 0x40)

	// ── Header ──
	push(0x1b, 0x61, 0x01) // center
	push(0x1b, 0x45, 0x01) // bold
	line(inv.company || "")
	push(0x1b, 0x45, 0x00) // bold off

	// Company address from cache
	try {
		const addr = getCachedCompanyAddress()
		if (addr) {
			if (addr.address_line1) line(addr.address_line1)
			if (addr.address_line2) line(addr.address_line2)
			const cityPhone = [addr.city, addr.phone].filter(Boolean).join(" | ")
			if (cityPhone) line(cityPhone)
		}
	} catch {}

	push(0x1b, 0x61, 0x00) // left align
	sep()

	// ── Invoice info ──
	const postDate = inv.posting_date ? fmtDate(new Date(inv.posting_date)) : fmtDate(new Date())
	const postTime = (inv.posting_time || "").substring(0, 5)
	const ownerShort = (inv.owner || "Kasir").substring(0, 8)
	const customerRaw = inv.customer_name || inv.customer || "Guest"
	const customer = customerRaw.split(" XSA")[0].split(" XPY")[0].split(" XS")[0].split(" - ")[0]

	line(`No : ${inv.name || ""}`)
	line(`Ksr: ${ownerShort}  Tgl: ${postDate} ${postTime}`)
	line(`Pel: ${customer}`)
	sep()

	// ── Items ──
	for (const item of (inv.items || [])) {
		const qty = item.qty ?? item.quantity ?? 0
		const rate = item.rate || 0
		const amount = item.amount ?? qty * rate
		const displayQty = qty % 1 === 0 ? Math.floor(qty) : qty
		line(item.item_name || item.item_code || "")
		line(_row(`  ${displayQty} x ${_num(rate)}`, _num(amount)))
		if (item.discount_amount > 0) line(_row("  Diskon", `-${_num(item.discount_amount)}`))
	}
	sep()

	// ── Totals ──
	if (inv.taxes && inv.taxes.length) {
		for (const tax of inv.taxes) {
			if (!tax.included_in_print_rate) {
				const desc = tax.description || ""
				const label = desc.includes("%") ? desc : `${desc}@${tax.rate}%`
				line(_row(label, _num(tax.tax_amount)))
			}
		}
	}
	if (inv.discount_amount > 0) line(_row("Diskon", `-${_num(inv.discount_amount)}`))
	if (inv.loyalty_amount > 0) line(_row("Tukar Poin", `-${_num(inv.loyalty_amount)}`))

	sep("=")
	push(0x1b, 0x45, 0x01) // bold
	line(_row("Grand Total", `Rp${_num(inv.grand_total)}`))
	push(0x1b, 0x45, 0x00)
	sep("=")

	// ── Payments ──
	for (const pay of (inv.payments || [])) {
		line(_row(pay.mode_of_payment, _num(pay.amount)))
	}
	const paidAmount = inv.paid_amount || (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
	line(_row("Bayar", _num(paidAmount)))
	if (inv.change_amount > 0) line(_row("Kembali", _num(inv.change_amount)))
	if (inv.outstanding_amount > 0) line(_row("Sisa Tagihan", _num(inv.outstanding_amount)))

	sep()
	push(0x1b, 0x61, 0x01) // center
	line("Terima kasih, sampai jumpa lagi.")
	push(0x1b, 0x61, 0x00)

	// Feed + cut
	push(0x1b, 0x64, 0x04) // feed 4 lines
	push(0x1d, 0x56, 0x00) // full cut (ignored if printer doesn't support)

	return new Uint8Array(b)
}

// ── Label printer ─────────────────────────────────────────────────────────────

function _buildLabel(itemName, remarks) {
	const enc = new TextEncoder()
	const b = []

	const push = (...bytes) => b.push(...bytes)
	const text = (str) => b.push(...enc.encode(str))

	// Initialize printer
	push(0x1b, 0x40)
	// Center align
	push(0x1b, 0x61, 0x01)
	// Double height + double width for item name
	push(0x1d, 0x21, 0x11)
	// Bold on
	push(0x1b, 0x45, 0x01)
	text(itemName + "\n")
	// Back to normal size, bold off
	push(0x1d, 0x21, 0x00)
	push(0x1b, 0x45, 0x00)

	if (remarks && remarks.trim()) {
		text(remarks.trim() + "\n")
	}

	// Feed lines to fill remaining 44mm label height (~8 lines at 203dpi)
	push(0x1b, 0x64, 0x08)

	return new Uint8Array(b)
}

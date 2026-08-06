// BLE thermal printer utility (58mm ESC/POS)
// Supports common Chinese 58mm BLE printers (iWare, etc.)

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

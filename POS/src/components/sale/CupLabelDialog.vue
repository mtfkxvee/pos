<template>
	<Dialog
		v-model="show"
		:options="{ title: __('Print Cup Labels'), size: 'sm' }"
	>
		<template #body-content>
			<div class="flex flex-col gap-3">
				<!-- Loading state -->
				<div v-if="loading" class="text-center py-6">
					<div class="animate-spin h-6 w-6 border-b-2 border-purple-500 rounded-full mx-auto"></div>
					<p class="mt-2 text-xs text-gray-500">{{ __('Loading items...') }}</p>
				</div>

				<!-- Empty state -->
				<div v-else-if="localItems.length === 0" class="text-center py-6 text-gray-400 text-sm">
					{{ __('No items found in this invoice.') }}
				</div>

				<!-- Item checklist -->
				<div v-else class="flex flex-col gap-1">
					<p class="text-xs text-gray-500 mb-1">
						{{ __('Pilih item yang akan dicetak labelnya:') }}
					</p>

					<!-- Select All / None -->
					<div class="flex items-center gap-2 pb-2 border-b border-gray-100">
						<button
							class="text-xs text-purple-600 hover:underline"
							@click="setAll(true)"
						>{{ __('Pilih Semua') }}</button>
						<span class="text-gray-300">|</span>
						<button
							class="text-xs text-gray-500 hover:underline"
							@click="setAll(false)"
						>{{ __('Batal Semua') }}</button>
					</div>

					<label
						v-for="(item, idx) in localItems"
						:key="idx"
						class="flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors select-none"
					>
						<input
							type="checkbox"
							v-model="item.checked"
							class="mt-0.5 w-4 h-4 rounded accent-purple-600 cursor-pointer flex-shrink-0"
						/>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-900 leading-snug">{{ item.item_name }}</p>
							<p class="text-xs text-gray-400">
								{{ __('Qty') }}: {{ item.qty }}
								<span v-if="labelCopies(item) > 1" class="text-purple-500 ml-1">
									→ {{ labelCopies(item) }} label
								</span>
							</p>
							<p v-if="remarks" class="text-xs text-purple-700 mt-0.5 italic truncate">
								{{ remarks }}
							</p>
						</div>
					</label>
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex gap-2 w-full justify-end">
				<Button variant="subtle" @click="show = false">
					{{ __('Batal') }}
				</Button>
				<button
					:disabled="loading || !localItems.some(i => i.checked)"
					class="px-4 py-1.5 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					@click="printLabels"
				>
					{{ __('Print Label') }}
				</button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue"
import { Button, Dialog } from "frappe-ui"
import { useToast } from "@/composables/useToast"
import { usePOSSettingsStore } from "@/stores/posSettings"
import { getBTPrinterName, printLabelBT } from "@/utils/bluetoothPrinter"
import { getUSBPrinterName, printLabelUSB } from "@/utils/usbPrinter"

const props = defineProps({
	modelValue: Boolean,
	/** Array of { item_name: string, qty: number } */
	items: { type: Array, default: () => [] },
	loading: { type: Boolean, default: false },
	remarks: { type: String, default: "" },
	serving: { type: String, default: "" },
})

const emit = defineEmits(["update:modelValue"])

const settingsStore = usePOSSettingsStore()
const { showError } = useToast()

const show = computed({
	get: () => props.modelValue,
	set: (v) => emit("update:modelValue", v),
})

// Local reactive copy with checked flag
const localItems = ref([])

watch(
	() => props.items,
	(items) => {
		localItems.value = (items || []).map((item) => ({ ...item, checked: true }))
	},
	{ immediate: true },
)

function labelCopies(item) {
	const qty = Number(item.qty) || 1
	return qty < 1 ? 1 : Math.ceil(qty)
}

function setAll(checked) {
	localItems.value.forEach((i) => { i.checked = checked })
}

function escapeHtml(text) {
	return String(text || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
}

async function printLabels() {
	const selected = localItems.value.filter((i) => i.checked)
	if (!selected.length) return
	const remarksLabel = [props.serving, props.remarks].filter(Boolean).join(" | ")
	const remarks = remarksLabel

	// Priority: USB → Bluetooth → browser window
	if (getUSBPrinterName() && settingsStore.enableUsbLabelPrinter) {
		show.value = false
		try {
			const totalLabels = selected.reduce((s, i) => s + labelCopies(i), 0)
			let seq = 0
			for (const item of selected) {
				const qty = labelCopies(item)
				for (let i = 0; i < qty; i++) {
					seq++
					await printLabelUSB(item.item_name, remarks, seq, totalLabels)
					if (seq < totalLabels) await new Promise((r) => setTimeout(r, 200))
				}
			}
		} catch (err) {
			showError(err.message || __("Gagal print ke USB printer"))
		}
		return
	}

	if (getBTPrinterName() && settingsStore.enableBluetoothPrinter) {
		show.value = false
		try {
			for (const item of selected) {
				await printLabelBT(item.item_name, remarks, labelCopies(item))
			}
		} catch (err) {
			showError(err.message || __("Gagal print ke Bluetooth printer"))
		}
		return
	}

	// Browser window fallback
	const _now = new Date()
	const timeStr = `${String(_now.getHours()).padStart(2, "0")}:${String(_now.getMinutes()).padStart(2, "0")}`

	const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 58" class="logo">
  <text x="110" y="22" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="22" font-weight="900"
    text-anchor="middle" stroke="black" stroke-width="4" stroke-linejoin="round" fill="white" letter-spacing="4">X-Sha</text>
  <text x="110" y="54" font-family="'Arial Black',Impact,Arial,sans-serif" font-size="34" font-weight="900"
    text-anchor="middle" fill="black" letter-spacing="1">grow</text>
</svg>`

	const labelsHtml = selected
		.flatMap((item) =>
			Array.from({ length: labelCopies(item) }, () => `
				<div class="label">
					${logoSvg}
					<div class="divider"></div>
					<div class="item-name">${escapeHtml(item.item_name)}</div>
					${remarks ? `<div class="remarks">${escapeHtml(remarks)}</div>` : ""}
					<div class="time">${timeStr}</div>
				</div>`),
		)
		.join("")

	const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  @page { size: 58mm 44mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; background: #fff; }
  .label { width: 58mm; height: 44mm; page-break-after: always; display: flex; flex-direction: column;
    align-items: center; text-align: center; padding: 1.5mm 3mm; overflow: hidden; gap: 0.8mm; }
  .label:last-child { page-break-after: avoid; }
  .logo { width: 46mm; height: auto; display: block; flex-shrink: 0; }
  .divider { width: 90%; border-top: 0.4mm solid #000; flex-shrink: 0; }
  .item-name { font-size: 13pt; font-weight: bold; line-height: 1.2; word-break: break-word; hyphens: auto; max-width: 100%; }
  .remarks { font-size: 9pt; line-height: 1.3; word-break: break-word; max-width: 100%; }
  .time { font-size: 8pt; margin-top: auto; color: #222; }
</style></head><body>${labelsHtml}</body></html>`

	show.value = false
	const win = window.open("", "_blank", "width=400,height=300")
	if (!win) {
		showError(__("Popup diblokir. Izinkan popup untuk mencetak label."))
		return
	}
	win.document.write(html)
	win.document.close()
	win.focus()
	setTimeout(() => { win.print(); win.close() }, 250)
}
</script>

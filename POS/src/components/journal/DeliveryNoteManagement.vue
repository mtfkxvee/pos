<template>
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[300]"
			@click.self="handleClose"
		>
			<div class="fixed inset-0 flex items-center justify-center p-4">
				<div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">

					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
						<div class="flex items-center gap-3">
							<TruckIcon class="w-5 h-5 text-sky-600" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{{ __('Delivery Note') }}</h2>
								<p class="text-sm text-gray-500">{{ __('Daftar surat jalan untuk POS Profile ini') }}</p>
							</div>
						</div>
						<button
							@click="handleClose"
							class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
						>
							<XMarkIcon class="w-5 h-5" />
						</button>
					</div>

					<!-- ── LIST VIEW ── -->
					<div class="flex-1 overflow-auto">
						<div v-if="loading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
							<TruckIcon class="w-10 h-10 opacity-30" />
							<span class="text-sm">{{ __('Belum ada delivery note') }}</span>
						</div>
						<table v-else class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
								<tr>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Tanggal') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Invoice') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Pelanggan') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Alamat Pengiriman') }}</th>
									<th class="px-5 py-3 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Total') }}</th>
									<th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ __('Actions') }}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								<tr
									v-for="entry in entries"
									:key="entry.name"
									class="hover:bg-gray-50"
								>
									<td class="px-5 py-3 text-gray-700 whitespace-nowrap">{{ formatDateTime(entry.posting_date, entry.posting_time) }}</td>
									<td class="px-5 py-3 text-gray-400 font-mono text-xs">{{ entry.name }}</td>
									<td class="px-5 py-3 text-gray-600">{{ entry.customer_name || entry.customer }}</td>
									<td class="px-5 py-3 text-gray-600 max-w-xs truncate" :title="entry.custom_shipping_address">{{ entry.custom_shipping_address }}</td>
									<td class="px-5 py-3 text-end font-medium text-gray-800">{{ formatCurrency(entry.grand_total) }}</td>
									<td class="px-5 py-3 text-center">
										<button
											@click="handlePrint(entry.name)"
											:disabled="printingName === entry.name"
											class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-sky-400 text-sky-700 rounded-lg hover:bg-sky-50 transition-colors disabled:opacity-50"
										>
											<PrinterIcon class="w-3.5 h-3.5" />
											{{ printingName === entry.name ? __('Mencetak...') : __('Print') }}
										</button>
									</td>
								</tr>
							</tbody>
						</table>
						<div v-if="hasMore" class="flex justify-center py-4">
							<button @click="loadMore" class="text-sm text-sky-600 hover:text-sky-700 font-medium">
								{{ __('Load more') }}
							</button>
						</div>
					</div>

				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch } from "vue"
import { TruckIcon, XMarkIcon, PrinterIcon } from "@heroicons/vue/24/outline"
import { call } from "@/utils/apiWrapper"
import { useToast } from "@/composables/useToast"
import { friendlyError } from "@/utils/errorHandler"
import { printInvoiceByName } from "@/utils/printInvoice"
import { usePrintFormat } from "@/composables/usePrintFormat"

const props = defineProps({
	modelValue: Boolean,
	posProfile: { type: String, default: "" },
	currency: { type: String, default: "IDR" },
})
const emit = defineEmits(["update:modelValue"])
const { showError } = useToast()
const { getPaperSize } = usePrintFormat()

// ── State ─────────────────────────────────────────────────────────────────────
const show = ref(props.modelValue)
const loading = ref(false)
const entries = ref([])
const page = ref(1)
const PAGE_SIZE = 20
const hasMore = ref(false)
const printingName = ref(null)

// ── Sync v-model ──────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => { show.value = val })
watch(show, (val) => { emit("update:modelValue", val) })

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(date, time) {
	if (!date) return ""
	const timePart = time ? ` ${String(time).split(".")[0]}` : ""
	return new Date(`${date}${timePart}`).toLocaleString("id-ID")
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: props.currency || "IDR",
		minimumFractionDigits: 0,
	}).format(amount || 0)
}

function handleClose() { show.value = false }

// ── API calls ─────────────────────────────────────────────────────────────────
async function loadEntries(reset = false) {
	if (!props.posProfile) return
	if (reset) { page.value = 1; entries.value = [] }
	loading.value = true
	try {
		const rows = await call("pos_next.api.delivery_notes.get_delivery_notes", {
			pos_profile: props.posProfile,
			page_size: PAGE_SIZE,
			page: page.value,
		}) || []
		entries.value = reset ? rows : [...entries.value, ...rows]
		hasMore.value = rows.length === PAGE_SIZE
	} catch (e) {
		showError(friendlyError(e, __("Failed to load delivery notes.")))
	} finally {
		loading.value = false
	}
}

async function loadMore() {
	page.value++
	await loadEntries(false)
}

async function handlePrint(name) {
	printingName.value = name
	try {
		await printInvoiceByName(name, "POS Next Delivery Note", null, getPaperSize())
	} catch (e) {
		showError(friendlyError(e, __("Failed to print delivery note.")))
	} finally {
		printingName.value = null
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────
watch(
	() => props.modelValue,
	async (val) => {
		if (val) {
			await loadEntries(true)
		}
	},
)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>

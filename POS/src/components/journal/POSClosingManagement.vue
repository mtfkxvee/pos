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
							<ClipboardDocumentCheckIcon class="w-5 h-5 text-teal-600" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{{ __('POS Closing') }}</h2>
								<p class="text-sm text-gray-500">{{ __('Riwayat closing kasir') }}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								v-if="view !== 'list'"
								@click="goToList"
								class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
							>
								<ArrowLeftIcon class="w-4 h-4" />
								{{ __('Back') }}
							</button>
							<button
								@click="handleClose"
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
							>
								<XMarkIcon class="w-5 h-5" />
							</button>
						</div>
					</div>

					<!-- ── LIST VIEW ── -->
					<div v-if="view === 'list'" class="flex-1 overflow-auto">
						<div v-if="loading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
							<ClipboardDocumentCheckIcon class="w-10 h-10 opacity-30" />
							<span class="text-sm">{{ __('Belum ada riwayat closing') }}</span>
						</div>
						<table v-else class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
								<tr>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Tanggal') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('ID') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Kasir') }}</th>
									<th class="px-5 py-3 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Total') }}</th>
									<th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ __('Visitor') }}</th>
									<th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ __('Status') }}</th>
									<th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ __('Actions') }}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								<tr
									v-for="entry in entries"
									:key="entry.name"
									class="hover:bg-gray-50 cursor-pointer"
									@click="openDetail(entry)"
								>
									<td class="px-5 py-3 text-gray-700 whitespace-nowrap">{{ formatDateTime(entry.period_end_date) }}</td>
									<td class="px-5 py-3 text-gray-400 font-mono text-xs">{{ entry.name }}</td>
									<td class="px-5 py-3 text-gray-600">{{ entry.cashier_name || entry.user }}</td>
									<td class="px-5 py-3 text-end font-medium text-gray-800">{{ formatCurrency(entry.grand_total) }}</td>
									<td class="px-5 py-3 text-center" @click.stop>
										<template v-if="entry.docstatus === 1">
											<span
												v-if="visitorEditId !== entry.name"
												@click="startVisitorEdit(entry)"
												class="inline-flex items-center gap-1 cursor-pointer group"
												:title="__('Klik untuk edit')"
											>
												<span :class="entry.visitor ? 'text-gray-800 font-medium' : 'text-gray-300 italic'">
													{{ entry.visitor || __('–') }}
												</span>
												<PencilIcon class="w-3 h-3 text-gray-300 group-hover:text-teal-500 transition-colors" />
											</span>
											<span v-else class="inline-flex items-center gap-1" @click.stop>
												<input
													v-model.number="visitorInput"
													type="number"
													min="0"
													class="w-16 h-6 px-1 text-xs text-center border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
													@keyup.enter="saveVisitor(entry)"
													@keyup.escape="cancelVisitorEdit"
												/>
												<button
													@click="saveVisitor(entry)"
													:disabled="visitorSaving"
													class="p-0.5 text-teal-600 hover:text-teal-800 disabled:opacity-50"
												>
													<CheckIcon class="w-4 h-4" />
												</button>
												<button @click="cancelVisitorEdit" class="p-0.5 text-gray-400 hover:text-gray-600">
													<XMarkIcon class="w-4 h-4" />
												</button>
											</span>
										</template>
										<span v-else class="text-xs text-gray-300">-</span>
									</td>
									<td class="px-5 py-3 text-center">
										<span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', statusBadgeClass(entry.docstatus)]">
											{{ statusLabel(entry.docstatus) }}
										</span>
									</td>
									<td class="px-5 py-3 text-center" @click.stop>
										<button
											v-if="entry.docstatus === 1"
											@click="handlePrint(entry.name)"
											:disabled="printingName === entry.name"
											class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-teal-400 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50"
										>
											<PrinterIcon class="w-3.5 h-3.5" />
											{{ printingName === entry.name ? __('Mencetak...') : __('Print') }}
										</button>
										<span v-else class="text-xs text-gray-300">-</span>
									</td>
								</tr>
							</tbody>
						</table>
						<div v-if="hasMore" class="flex justify-center py-4">
							<button @click="loadMore" class="text-sm text-teal-600 hover:text-teal-700 font-medium">
								{{ __('Load more') }}
							</button>
						</div>
					</div>

					<!-- ── DETAIL VIEW ── -->
					<div v-else-if="view === 'detail'" class="flex-1 overflow-auto">
						<div v-if="!detail" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<div v-else class="max-w-2xl mx-auto px-6 py-5">
							<!-- Meta -->
							<div class="grid grid-cols-3 gap-4 mb-6">
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Tanggal') }}</p>
									<p class="text-sm font-medium text-gray-800">{{ formatDateTime(detail.period_end_date) }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Kasir') }}</p>
									<p class="text-sm font-medium text-gray-800">{{ detail.cashier_name || detail.user }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Status') }}</p>
									<span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', statusBadgeClass(detail.docstatus)]">
										{{ statusLabel(detail.docstatus) }}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-3 gap-4 mb-6">
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Mulai Shift') }}</p>
									<p class="text-sm text-gray-700">{{ formatDateTime(detail.period_start_date) }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Selesai Shift') }}</p>
									<p class="text-sm text-gray-700">{{ formatDateTime(detail.period_end_date) }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500 mb-1">{{ __('Grand Total') }}</p>
									<p class="text-sm font-semibold text-gray-900">{{ formatCurrency(detail.grand_total) }}</p>
								</div>
							</div>

							<!-- Visitor Edit (detail view) -->
							<div class="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-4">
								<div>
									<p class="text-xs text-gray-500 mb-0.5">{{ __('Visitor') }}</p>
									<p class="text-sm font-semibold text-gray-900">{{ detail.visitor || 0 }}</p>
								</div>
								<div v-if="visitorEditId === detail.name" class="flex items-center gap-2">
									<input
										v-model.number="visitorInput"
										type="number"
										min="0"
										class="w-24 h-8 px-2 text-sm text-center border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
										@keyup.enter="saveVisitor(detail)"
										@keyup.escape="cancelVisitorEdit"
									/>
									<button
										@click="saveVisitor(detail)"
										:disabled="visitorSaving"
										class="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-teal-400 text-teal-700 rounded-lg hover:bg-teal-50 disabled:opacity-50"
									>
										<CheckIcon class="w-3.5 h-3.5" />
										{{ visitorSaving ? __('Menyimpan...') : __('Simpan') }}
									</button>
									<button @click="cancelVisitorEdit" class="p-1.5 text-gray-400 hover:text-gray-600">
										<XMarkIcon class="w-4 h-4" />
									</button>
								</div>
								<button
									v-else
									@click="startVisitorEdit(detail)"
									class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
								>
									<PencilIcon class="w-3.5 h-3.5" />
									{{ __('Edit Visitor') }}
								</button>
							</div>

							<!-- Payment reconciliation -->
							<div v-if="detail.payment_reconciliation && detail.payment_reconciliation.length" class="border border-gray-200 rounded-lg overflow-hidden mb-6">
								<div class="grid grid-cols-[1fr_110px_110px_110px] bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 uppercase">
									<span>{{ __('Metode Pembayaran') }}</span>
									<span class="text-end">{{ __('Expected') }}</span>
									<span class="text-end">{{ __('Actual') }}</span>
									<span class="text-end">{{ __('Selisih') }}</span>
								</div>
								<div
									v-for="(row, idx) in detail.payment_reconciliation"
									:key="idx"
									class="grid grid-cols-[1fr_110px_110px_110px] border-b border-gray-100 last:border-0 px-4 py-2.5 items-center"
								>
									<p class="text-sm text-gray-800">{{ row.mode_of_payment }}</p>
									<p class="text-sm text-end text-gray-700">{{ formatCurrency(row.expected_amount) }}</p>
									<p class="text-sm text-end text-gray-700">{{ formatCurrency(row.closing_amount) }}</p>
									<p class="text-sm text-end font-medium" :class="(row.difference || 0) === 0 ? 'text-gray-400' : (row.difference || 0) > 0 ? 'text-green-600' : 'text-red-600'">
										{{ formatCurrency(row.difference) }}
									</p>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex gap-3 justify-end mt-6">
								<button
									v-if="detail.docstatus === 1"
									@click="handlePrint(detail.name)"
									:disabled="printingName === detail.name"
									class="flex items-center gap-1.5 px-4 py-2 text-sm border border-teal-400 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50"
								>
									<PrinterIcon class="w-4 h-4" />
									{{ printingName === detail.name ? __('Mencetak...') : __('Print') }}
								</button>
							</div>
						</div>
					</div>

				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch } from "vue"
import {
	ArrowLeftIcon, XMarkIcon, ClipboardDocumentCheckIcon, PrinterIcon,
	PencilIcon, CheckIcon,
} from "@heroicons/vue/24/outline"
import { call } from "@/utils/apiWrapper"
import { useToast } from "@/composables/useToast"
import { friendlyError } from "@/utils/errorHandler"
import { printShiftClosing } from "@/utils/printInvoice"
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
const view = ref("list")           // "list" | "detail"
const loading = ref(false)
const entries = ref([])
const detail = ref(null)
const page = ref(1)
const PAGE_SIZE = 20
const hasMore = ref(false)
const printingName = ref(null)

// Visitor inline edit state
const visitorEditId = ref(null)
const visitorInput = ref(0)
const visitorSaving = ref(false)

function startVisitorEdit(entry) {
	visitorEditId.value = entry.name
	visitorInput.value = entry.visitor || 0
}

function cancelVisitorEdit() {
	visitorEditId.value = null
	visitorInput.value = 0
}

async function saveVisitor(entry) {
	visitorSaving.value = true
	try {
		const result = await call("pos_next.api.pos_closing.set_visitor_count", {
			name: entry.name,
			visitor: visitorInput.value,
		})
		entry.visitor = result.visitor
		if (detail.value && detail.value.name === entry.name) {
			detail.value.visitor = result.visitor
		}
		cancelVisitorEdit()
	} catch (e) {
		showError(friendlyError(e, __("Gagal menyimpan visitor")))
	} finally {
		visitorSaving.value = false
	}
}

// ── Sync v-model ──────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => { show.value = val })
watch(show, (val) => { emit("update:modelValue", val) })

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(d) {
	if (!d) return ""
	return new Date(d).toLocaleString("id-ID")
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: props.currency || "IDR",
		minimumFractionDigits: 0,
	}).format(amount || 0)
}

function statusLabel(docstatus) {
	if (docstatus === 1) return __("Submitted")
	if (docstatus === 2) return __("Cancelled")
	return __("Draft")
}

function statusBadgeClass(docstatus) {
	if (docstatus === 1) return "bg-green-100 text-green-700"
	if (docstatus === 2) return "bg-red-100 text-red-700"
	return "bg-yellow-100 text-yellow-700"
}

function goToList() {
	view.value = "list"
	detail.value = null
}

function handleClose() { show.value = false }

// ── API calls ─────────────────────────────────────────────────────────────────
async function loadEntries(reset = false) {
	if (!props.posProfile) return
	if (reset) { page.value = 1; entries.value = [] }
	loading.value = true
	try {
		const rows = await call("pos_next.api.pos_closing.get_pos_closing_shifts", {
			pos_profile: props.posProfile,
			page_size: PAGE_SIZE,
			page: page.value,
		}) || []
		entries.value = reset ? rows : [...entries.value, ...rows]
		hasMore.value = rows.length === PAGE_SIZE
	} catch (e) {
		showError(friendlyError(e, __("Failed to load closing history.")))
	} finally {
		loading.value = false
	}
}

async function loadMore() {
	page.value++
	await loadEntries(false)
}

function openDetail(entry) {
	view.value = "detail"
	detail.value = entry
}

async function handlePrint(name) {
	printingName.value = name
	try {
		const data = await call("pos_next.api.pos_closing.get_pos_closing_shift_print_data", { name })
		printShiftClosing(data, getPaperSize())
	} catch (e) {
		showError(friendlyError(e, __("Failed to print closing report.")))
	} finally {
		printingName.value = null
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────
watch(
	() => props.modelValue,
	async (val) => {
		if (val) {
			goToList()
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

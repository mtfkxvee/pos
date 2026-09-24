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
							<button
								v-if="view === 'detail'"
								@click="backToList"
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
							>
								<ArrowLeftIcon class="w-5 h-5" />
							</button>
							<GlobeAltIcon class="w-5 h-5 text-orange-600" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{{ __('Online Order') }}</h2>
								<p class="text-sm text-gray-500">
									{{ view === 'list' ? __('Daftar Sales Order untuk outlet ini') : selectedOrder?.name }}
								</p>
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
					<div v-if="view === 'list'" class="flex-1 overflow-auto">
						<div v-if="loading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
							<GlobeAltIcon class="w-10 h-10 opacity-30" />
							<span class="text-sm">{{ __('Belum ada online order untuk outlet ini') }}</span>
						</div>
						<table v-else class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
								<tr>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Tanggal') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('No. Order') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Pelanggan') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Status') }}</th>
									<th class="px-5 py-3 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Total') }}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								<tr
									v-for="entry in entries"
									:key="entry.name"
									class="hover:bg-gray-50 cursor-pointer"
									@click="openDetail(entry.name)"
								>
									<td class="px-5 py-3 text-gray-700 whitespace-nowrap">{{ formatDate(entry.transaction_date) }}</td>
									<td class="px-5 py-3 text-gray-400 font-mono text-xs">{{ entry.name }}</td>
									<td class="px-5 py-3 text-gray-600">{{ entry.customer_name || entry.customer }}</td>
									<td class="px-5 py-3">
										<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
											{{ entry.status }}
										</span>
									</td>
									<td class="px-5 py-3 text-end font-medium text-gray-800">{{ formatCurrency(entry.grand_total) }}</td>
								</tr>
							</tbody>
						</table>
						<div v-if="hasMore" class="flex justify-center py-4">
							<button @click="loadMore" class="text-sm text-orange-600 hover:text-orange-700 font-medium">
								{{ __('Load more') }}
							</button>
						</div>
					</div>

					<!-- ── DETAIL VIEW ── -->
					<div v-else-if="view === 'detail'" class="flex-1 overflow-auto p-6">
						<div v-if="detailLoading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<div v-else-if="selectedOrder" class="space-y-6 max-w-3xl mx-auto">
							<!-- Header info -->
							<div class="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
								<div>
									<p class="text-xs text-gray-500">{{ __('Pelanggan') }}</p>
									<p class="font-medium text-gray-900">{{ selectedOrder.customer_name || selectedOrder.customer }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500">{{ __('Tanggal') }}</p>
									<p class="font-medium text-gray-900">{{ formatDate(selectedOrder.transaction_date) }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500">{{ __('Metode Pembayaran') }}</p>
									<p class="font-medium text-gray-900">{{ selectedOrder.custom_payment_method || '—' }}</p>
								</div>
								<div>
									<p class="text-xs text-gray-500">{{ __('Nominal Pembayaran') }}</p>
									<p class="font-medium text-gray-900">{{ formatCurrency(selectedOrder.custom_payment_amount) }}</p>
								</div>
							</div>

							<!-- Items -->
							<div>
								<table class="w-full text-sm border rounded-lg overflow-hidden">
									<thead class="bg-gray-50 border-b">
										<tr>
											<th class="px-4 py-2 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Item') }}</th>
											<th class="px-4 py-2 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Qty') }}</th>
											<th class="px-4 py-2 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Rate') }}</th>
											<th class="px-4 py-2 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Jumlah') }}</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										<tr v-for="(item, idx) in selectedOrder.items" :key="idx">
											<td class="px-4 py-2 text-gray-800">{{ item.item_name || item.item_code }}</td>
											<td class="px-4 py-2 text-end text-gray-600">{{ item.qty }} {{ item.uom }}</td>
											<td class="px-4 py-2 text-end text-gray-600">{{ formatCurrency(item.rate) }}</td>
											<td class="px-4 py-2 text-end font-medium text-gray-800">{{ formatCurrency(item.amount) }}</td>
										</tr>
									</tbody>
									<tfoot class="bg-gray-50 border-t">
										<tr>
											<td colspan="3" class="px-4 py-2 text-end font-semibold text-gray-700">{{ __('Grand Total') }}</td>
											<td class="px-4 py-2 text-end font-bold text-gray-900">{{ formatCurrency(selectedOrder.grand_total) }}</td>
										</tr>
									</tfoot>
								</table>
							</div>

							<!-- Status trail -->
							<div class="flex items-center gap-2 text-sm">
								<span
									class="px-2 py-1 rounded-full font-medium"
									:class="selectedOrder.sales_invoice ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
								>
									{{ selectedOrder.sales_invoice ? __('Sudah disiapkan: {0}', [selectedOrder.sales_invoice]) : __('Belum disiapkan') }}
								</span>
								<span
									v-if="selectedOrder.sales_invoice"
									class="px-2 py-1 rounded-full font-medium"
									:class="lastDeliveryRequest ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
								>
									{{ lastDeliveryRequest ? __('Delivery Request dibuat: {0}', [lastDeliveryRequest]) : __('Belum dikirim') }}
								</span>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-3 pt-2 border-t">
								<button
									@click="handlePrepare"
									:disabled="!!selectedOrder.sales_invoice || preparing || !selectedOrder.custom_payment_method"
									class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<CheckCircleIcon class="w-4 h-4" />
									{{ preparing ? __('Menyiapkan...') : __('Siapkan') }}
								</button>
								<button
									@click="handleSend"
									:disabled="!selectedOrder.sales_invoice || sending || !!lastDeliveryRequest"
									class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<TruckIcon class="w-4 h-4" />
									{{ sending ? __('Mengirim...') : (lastDeliveryRequest ? __('Sudah Dikirim') : __('Kirim')) }}
								</button>
								<p v-if="!selectedOrder.custom_payment_method && !selectedOrder.sales_invoice" class="text-xs text-amber-600">
									{{ __('Order ini belum punya Metode Pembayaran, tidak bisa disiapkan.') }}
								</p>
							</div>
							<p class="text-xs text-gray-400">
								{{ __('Delivery Request hanya untuk pelacakan pengiriman — tidak terhubung otomatis ke sistem akuntansi.') }}
							</p>
						</div>
					</div>

				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch } from "vue"
import { XMarkIcon, GlobeAltIcon, ArrowLeftIcon, CheckCircleIcon, TruckIcon } from "@heroicons/vue/24/outline"
import { call } from "@/utils/apiWrapper"
import { useToast } from "@/composables/useToast"
import { friendlyError } from "@/utils/errorHandler"

const props = defineProps({
	modelValue: Boolean,
	posProfile: { type: String, default: "" },
	posOpeningShift: { type: String, default: "" },
	currency: { type: String, default: "IDR" },
})
const emit = defineEmits(["update:modelValue"])
const { showSuccess, showError } = useToast()

// ── State ─────────────────────────────────────────────────────────────────────
const show = ref(props.modelValue)
const view = ref("list") // 'list' | 'detail'
const loading = ref(false)
const entries = ref([])
const page = ref(1)
const PAGE_SIZE = 20
const hasMore = ref(false)

const detailLoading = ref(false)
const selectedOrder = ref(null)
const preparing = ref(false)
const sending = ref(false)
// Delivery Request has no link field back to the Sales Order (see backend
// module docstring), so "already sent" can only be tracked for the current
// viewing session, not persisted/reloaded from the server.
const lastDeliveryRequest = ref(null)

// ── Sync v-model ──────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => { show.value = val })
watch(show, (val) => { emit("update:modelValue", val) })

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
	if (!date) return ""
	return new Date(date).toLocaleDateString("id-ID")
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: props.currency || "IDR",
		minimumFractionDigits: 0,
	}).format(amount || 0)
}

function handleClose() { show.value = false }

function backToList() {
	view.value = "list"
	selectedOrder.value = null
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function loadEntries(reset = false) {
	if (!props.posProfile) return
	if (reset) { page.value = 1; entries.value = [] }
	loading.value = true
	try {
		const rows = await call("pos_next.api.sales_orders.get_sales_orders", {
			pos_profile: props.posProfile,
			page_size: PAGE_SIZE,
			page: page.value,
		}) || []
		entries.value = reset ? rows : [...entries.value, ...rows]
		hasMore.value = rows.length === PAGE_SIZE
	} catch (e) {
		showError(friendlyError(e, __("Failed to load online orders.")))
	} finally {
		loading.value = false
	}
}

async function loadMore() {
	page.value++
	await loadEntries(false)
}

async function openDetail(name) {
	view.value = "detail"
	detailLoading.value = true
	selectedOrder.value = null
	lastDeliveryRequest.value = null
	try {
		selectedOrder.value = await call("pos_next.api.sales_orders.get_sales_order_detail", {
			sales_order: name,
		})
	} catch (e) {
		showError(friendlyError(e, __("Failed to load order details.")))
		view.value = "list"
	} finally {
		detailLoading.value = false
	}
}

async function refreshDetail() {
	if (!selectedOrder.value) return
	await openDetail(selectedOrder.value.name)
}

async function handlePrepare() {
	if (!selectedOrder.value) return
	preparing.value = true
	try {
		const result = await call("pos_next.api.sales_orders.prepare_sales_invoice_from_order", {
			sales_order: selectedOrder.value.name,
			pos_profile: props.posProfile,
			pos_opening_shift: props.posOpeningShift,
		})
		showSuccess(__("Sales Invoice {0} berhasil dibuat", [result.sales_invoice]))
		await refreshDetail()
	} catch (e) {
		showError(friendlyError(e, __("Failed to prepare invoice.")))
	} finally {
		preparing.value = false
	}
}

async function handleSend() {
	if (!selectedOrder.value?.sales_invoice) return
	sending.value = true
	try {
		const result = await call("pos_next.api.sales_orders.create_delivery_request_from_invoice", {
			sales_order: selectedOrder.value.name,
			sales_invoice: selectedOrder.value.sales_invoice,
			pos_profile: props.posProfile,
		})
		lastDeliveryRequest.value = result.delivery_request
		showSuccess(__("Delivery Request {0} berhasil dibuat", [result.delivery_request]))
	} catch (e) {
		showError(friendlyError(e, __("Failed to create delivery request.")))
	} finally {
		sending.value = false
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────
watch(
	() => props.modelValue,
	async (val) => {
		if (val) {
			view.value = "list"
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

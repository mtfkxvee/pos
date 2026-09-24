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
							<TruckIcon class="w-5 h-5 text-blue-600" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{{ __('Delivery Request') }}</h2>
								<p class="text-sm text-gray-500">
									{{ view === 'list' ? __('Daftar permintaan pengiriman untuk outlet ini') : selectedRequest?.name }}
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
							<TruckIcon class="w-10 h-10 opacity-30" />
							<span class="text-sm">{{ __('Belum ada delivery request') }}</span>
						</div>
						<table v-else class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
								<tr>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Tanggal') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('No. Request') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Pelanggan') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Alamat') }}</th>
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
									<td class="px-5 py-3 text-gray-700 whitespace-nowrap">{{ formatDateTime(entry.creation) }}</td>
									<td class="px-5 py-3 text-gray-400 font-mono text-xs">{{ entry.name }}</td>
									<td class="px-5 py-3 text-gray-600">
										{{ entry.customer_name }}
										<div class="text-xs text-gray-400">{{ entry.phone }}</div>
									</td>
									<td class="px-5 py-3 text-gray-600 max-w-xs truncate" :title="entry.address_street">{{ entry.address_street }}</td>
									<td class="px-5 py-3">
										<span
											class="px-2 py-0.5 rounded-full text-xs font-medium"
											:class="statusBadgeClass(entry.delivery_status)"
										>
											{{ entry.delivery_status }}
										</span>
									</td>
									<td class="px-5 py-3 text-end font-medium text-gray-800">{{ formatCurrency(entry.total_price) }}</td>
								</tr>
							</tbody>
						</table>
						<div v-if="hasMore" class="flex justify-center py-4">
							<button @click="loadMore" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
								{{ __('Load more') }}
							</button>
						</div>
					</div>

					<!-- ── DETAIL / EDIT VIEW ── -->
					<div v-else-if="view === 'detail'" class="flex-1 overflow-auto p-6">
						<div v-if="detailLoading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>
						<form v-else-if="form" @submit.prevent="handleSave" class="space-y-5 max-w-2xl mx-auto">
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Status Pengiriman') }}</label>
									<select v-model="form.delivery_status" class="w-full border rounded-lg px-3 py-2 text-sm">
										<option v-for="s in DELIVERY_STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
									</select>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Kendaraan') }}</label>
									<select v-model="form.vehicle_type" class="w-full border rounded-lg px-3 py-2 text-sm">
										<option value="">—</option>
										<option value="MOTOR">MOTOR</option>
										<option value="MOBIL">MOBIL</option>
									</select>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Driver (Employee ID)') }}</label>
									<input v-model="form.driver" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" />
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Metode Pembayaran') }}</label>
									<select v-model="form.payment_method" class="w-full border rounded-lg px-3 py-2 text-sm">
										<option value="">—</option>
										<option value="COD">COD</option>
										<option value="Transfer">Transfer</option>
										<option value="Tunai">Tunai</option>
										<option value="QRIS">QRIS</option>
									</select>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Nama Pelanggan') }}</label>
									<input v-model="form.customer_name" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" required />
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('No. Telepon') }}</label>
									<input v-model="form.phone" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" required />
								</div>
							</div>

							<div>
								<label class="block text-xs text-gray-500 mb-1">{{ __('Alamat') }}</label>
								<textarea v-model="form.address_street" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" required></textarea>
							</div>

							<div class="grid grid-cols-3 gap-4">
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('RT/RW') }}</label>
									<input v-model="form.rt_rw" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" />
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Desa') }}</label>
									<input v-model="form.village" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" />
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Kecamatan') }}</label>
									<input v-model="form.district" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" />
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-xs text-gray-500 mb-1">{{ __('Produk yang Dibeli') }}</label>
									<textarea v-model="form.product_purchased" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
								</div>
								<div class="space-y-4">
									<div>
										<label class="block text-xs text-gray-500 mb-1">{{ __('Jumlah Produk') }}</label>
										<input v-model.number="form.product_qty" type="number" step="any" class="w-full border rounded-lg px-3 py-2 text-sm" />
									</div>
									<div>
										<label class="block text-xs text-gray-500 mb-1">{{ __('Total Harga') }}</label>
										<input v-model.number="form.total_price" type="number" step="any" class="w-full border rounded-lg px-3 py-2 text-sm" />
									</div>
								</div>
							</div>

							<div>
								<label class="block text-xs text-gray-500 mb-1">{{ __('Keterangan') }}</label>
								<textarea v-model="form.notes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
							</div>
							<div>
								<label class="block text-xs text-gray-500 mb-1">{{ __('Kendala') }}</label>
								<textarea v-model="form.issues" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
							</div>

							<div class="flex items-center gap-3 pt-2 border-t">
								<button
									type="submit"
									:disabled="saving"
									class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<CheckCircleIcon class="w-4 h-4" />
									{{ saving ? __('Menyimpan...') : __('Simpan') }}
								</button>
							</div>
						</form>
					</div>

				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch } from "vue"
import { TruckIcon, XMarkIcon, ArrowLeftIcon, CheckCircleIcon } from "@heroicons/vue/24/outline"
import { call } from "@/utils/apiWrapper"
import { useToast } from "@/composables/useToast"
import { friendlyError } from "@/utils/errorHandler"

const props = defineProps({
	modelValue: Boolean,
	posProfile: { type: String, default: "" },
	currency: { type: String, default: "IDR" },
})
const emit = defineEmits(["update:modelValue"])
const { showSuccess, showError } = useToast()

const DELIVERY_STATUS_OPTIONS = ["Pending", "Ditugaskan", "Dalam Perjalanan", "Terkirim", "Gagal"]

// ── State ─────────────────────────────────────────────────────────────────────
const show = ref(props.modelValue)
const view = ref("list") // 'list' | 'detail'
const loading = ref(false)
const entries = ref([])
const page = ref(1)
const PAGE_SIZE = 20
const hasMore = ref(false)

const detailLoading = ref(false)
const selectedRequest = ref(null)
const form = ref(null)
const saving = ref(false)

// ── Sync v-model ──────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => { show.value = val })
watch(show, (val) => { emit("update:modelValue", val) })

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(datetime) {
	if (!datetime) return ""
	return new Date(datetime).toLocaleString("id-ID")
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: props.currency || "IDR",
		minimumFractionDigits: 0,
	}).format(amount || 0)
}

function statusBadgeClass(status) {
	const map = {
		"Pending": "bg-amber-100 text-amber-700",
		"Ditugaskan": "bg-blue-100 text-blue-700",
		"Dalam Perjalanan": "bg-violet-100 text-violet-700",
		"Terkirim": "bg-green-100 text-green-700",
		"Gagal": "bg-red-100 text-red-700",
	}
	return map[status] || "bg-gray-100 text-gray-700"
}

function handleClose() { show.value = false }

function backToList() {
	view.value = "list"
	selectedRequest.value = null
	form.value = null
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function loadEntries(reset = false) {
	if (!props.posProfile) return
	if (reset) { page.value = 1; entries.value = [] }
	loading.value = true
	try {
		const rows = await call("pos_next.api.sales_orders.get_delivery_requests", {
			pos_profile: props.posProfile,
			page_size: PAGE_SIZE,
			page: page.value,
		}) || []
		entries.value = reset ? rows : [...entries.value, ...rows]
		hasMore.value = rows.length === PAGE_SIZE
	} catch (e) {
		showError(friendlyError(e, __("Failed to load delivery requests.")))
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
	selectedRequest.value = null
	form.value = null
	try {
		const detail = await call("pos_next.api.sales_orders.get_delivery_request_detail", {
			name,
			pos_profile: props.posProfile,
		})
		selectedRequest.value = detail
		form.value = { ...detail }
	} catch (e) {
		showError(friendlyError(e, __("Failed to load delivery request details.")))
		view.value = "list"
	} finally {
		detailLoading.value = false
	}
}

async function handleSave() {
	if (!form.value) return
	saving.value = true
	try {
		const updated = await call("pos_next.api.sales_orders.update_delivery_request", {
			name: form.value.name,
			pos_profile: props.posProfile,
			data: form.value,
		})
		selectedRequest.value = updated
		form.value = { ...updated }
		showSuccess(__("Delivery Request {0} berhasil disimpan", [updated.name]))
		// Reflect the edit in the list once the user goes back.
		const idx = entries.value.findIndex((e) => e.name === updated.name)
		if (idx !== -1) {
			entries.value[idx] = { ...entries.value[idx], ...updated }
		}
	} catch (e) {
		showError(friendlyError(e, __("Failed to save delivery request.")))
	} finally {
		saving.value = false
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

<template>
	<div class="flex flex-col h-full bg-gray-50">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
				<span class="text-sm font-semibold text-gray-700">{{ __('Order Monitor') }}</span>
				<span v-if="orders.length" class="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
					{{ orders.length }}
				</span>
			</div>
			<button
				@click="fetchOrders"
				:disabled="loading"
				class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
				title="Refresh"
			>
				<svg :class="['w-4 h-4 text-gray-500', loading && 'animate-spin']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
				</svg>
			</button>
		</div>

		<!-- Order list -->
		<div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
			<!-- Empty state -->
			<div v-if="!loading && orders.length === 0" class="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
				<svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
				<p class="text-sm text-gray-400 font-medium">{{ __('Tidak ada pesanan aktif') }}</p>
			</div>

			<!-- Loading skeleton -->
			<template v-if="loading && orders.length === 0">
				<div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-gray-100 p-3 animate-pulse">
					<div class="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
					<div class="h-3 bg-gray-100 rounded w-2/3"></div>
				</div>
			</template>

			<!-- Order cards -->
			<transition-group name="order-list" tag="div" class="flex flex-col gap-2">
				<div
					v-for="order in orders"
					:key="order.name"
					:class="[
						'bg-white rounded-xl border shadow-sm p-3 transition-all',
						order.status === 'Waiting' ? 'border-yellow-200' : 'border-green-200',
					]"
				>
					<!-- Top row: queue number + time -->
					<div class="flex items-start justify-between mb-2">
						<div class="flex items-center gap-2">
							<span :class="[
								'text-2xl font-black leading-none',
								order.status === 'Waiting' ? 'text-yellow-500' : 'text-green-500',
							]">
								#{{ order.order_number }}
							</span>
							<span :class="[
								'text-xs font-semibold px-2 py-0.5 rounded-full',
								order.status === 'Waiting'
									? 'bg-yellow-100 text-yellow-700'
									: 'bg-green-100 text-green-700',
							]">
								{{ order.status === 'Waiting' ? __('Menunggu') : __('Diproses') }}
							</span>
						</div>
						<span class="text-xs text-gray-400">{{ formatTime(order.posting_time) }}</span>
					</div>

					<!-- Customer name -->
					<p class="text-sm font-semibold text-gray-800 mb-1 truncate">{{ order.customer || '—' }}</p>

					<!-- Items summary -->
					<p v-if="order.items_summary" class="text-xs text-gray-500 mb-2.5 line-clamp-2 leading-relaxed">
						{{ order.items_summary }}
					</p>

					<!-- Action buttons -->
					<div class="flex gap-2">
						<button
							v-if="order.status === 'Waiting'"
							@click="updateStatus(order, 'Ready')"
							:disabled="order._updating"
							class="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
						>
							{{ order._updating ? '...' : __('On Progress') }}
						</button>
						<button
							@click="updateStatus(order, 'Done')"
							:disabled="order._updating"
							:class="[
								'py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50',
								order.status === 'Waiting'
									? 'px-3 bg-gray-100 hover:bg-gray-200 text-gray-600'
									: 'flex-1 bg-green-600 hover:bg-green-700 text-white',
							]"
						>
							{{ order._updating ? '...' : __('Complete') }}
						</button>
					</div>
				</div>
			</transition-group>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import { call } from "frappe-ui"
import { useToast } from "@/composables/useToast"

const { showError } = useToast()

const orders = ref([])
const loading = ref(false)

async function fetchOrders() {
	loading.value = true
	try {
		const result = await call("pos_next.api.order_tracking.get_order_tracking")
		orders.value = (result || []).map((o) => ({ ...o, _updating: false }))
	} catch (e) {
		showError(e.message || __("Gagal memuat order"))
	} finally {
		loading.value = false
	}
}

async function updateStatus(order, status) {
	order._updating = true
	try {
		await call("pos_next.api.order_tracking.update_order_status", {
			name: order.name,
			status,
		})
		if (status === "Done") {
			orders.value = orders.value.filter((o) => o.name !== order.name)
		} else {
			order.status = status
			order._updating = false
		}
	} catch (e) {
		order._updating = false
		showError(e.message || __("Gagal update status"))
	}
}

function formatTime(t) {
	if (!t) return ""
	return t.substring(0, 5)
}

function handleNewOrder(data) {
	// Avoid duplicate
	if (orders.value.some((o) => o.name === data.name)) return
	orders.value.unshift({ ...data, _updating: false })
	// Re-sort by order_number ascending
	orders.value.sort((a, b) => a.order_number - b.order_number)
}

function handleCancelOrder(data) {
	orders.value = orders.value.filter((o) => o.sales_invoice !== data.invoice)
}

function handleStatusChanged(data) {
	const o = orders.value.find((o) => o.name === data.name)
	if (!o) return
	if (data.status === "Done") {
		orders.value = orders.value.filter((o) => o.name !== data.name)
	} else {
		o.status = data.status
	}
}

onMounted(() => {
	fetchOrders()
	window.frappe?.realtime?.on("new_order", handleNewOrder)
	window.frappe?.realtime?.on("cancel_order", handleCancelOrder)
	window.frappe?.realtime?.on("order_status_changed", handleStatusChanged)
})

onUnmounted(() => {
	window.frappe?.realtime?.off("new_order", handleNewOrder)
	window.frappe?.realtime?.off("cancel_order", handleCancelOrder)
	window.frappe?.realtime?.off("order_status_changed", handleStatusChanged)
})
</script>

<style scoped>
.order-list-enter-active,
.order-list-leave-active {
	transition: all 0.25s ease;
}
.order-list-enter-from {
	opacity: 0;
	transform: translateY(-8px);
}
.order-list-leave-to {
	opacity: 0;
	transform: translateX(20px);
}
.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>

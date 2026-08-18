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
					<div class="h-3 bg-gray-100 rounded w-2/3 mb-1"></div>
					<div class="h-3 bg-gray-100 rounded w-1/2"></div>
				</div>
			</template>

			<!-- Order cards -->
			<transition-group name="order-list" tag="div" class="flex flex-col gap-2">
				<div
					v-for="(order, idx) in orders"
					:key="order.name"
					:class="[
						'bg-white rounded-xl border shadow-sm p-3 transition-all',
						order.status === 'Order Placed' ? 'border-yellow-200' : 'border-blue-200',
					]"
				>
					<!-- Top row: queue number + status + time -->
					<div class="flex items-start justify-between mb-2">
						<div class="flex items-center gap-2">
							<span :class="[
								'text-2xl font-black leading-none',
								order.status === 'Order Placed' ? 'text-yellow-500' : 'text-blue-500',
							]">
								#{{ idx + 1 }}
							</span>
							<span :class="[
								'text-xs font-semibold px-2 py-0.5 rounded-full',
								order.status === 'Order Placed'
									? 'bg-yellow-100 text-yellow-700'
									: 'bg-blue-100 text-blue-700',
							]">
								{{ order.status === 'Order Placed' ? __('Menunggu') : __('Diproses') }}
							</span>
						</div>
						<span class="text-xs text-gray-400">{{ formatTime(order.creation) }}</span>
					</div>

					<!-- Customer name + serving -->
					<div class="flex items-center gap-2 mb-2">
						<p class="text-sm font-semibold text-gray-800 truncate flex-1">{{ order.customer || '—' }}</p>
						<span v-if="order.serving" :class="[
							'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
							order.serving === 'Take Away' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
						]">{{ order.serving }}</span>
					</div>

					<!-- Items list with per-item status cards -->
					<div v-if="order.items && order.items.length" class="mb-2 flex flex-col gap-1.5">
						<div
							v-for="item in order.items"
							:key="item.name"
							:class="[
								'flex items-center gap-2 rounded-lg px-2.5 py-2 border',
								item.status === 'Complete'
									? 'bg-green-50 border-green-200'
									: item.status === 'On Progress'
										? 'bg-blue-50 border-blue-200'
										: 'bg-gray-50 border-gray-200',
							]"
						>
							<!-- Item info -->
							<div class="flex-1 min-w-0">
								<span class="text-sm font-bold text-gray-800">{{ item.qty }}x</span>
								<span class="text-sm text-gray-700 ml-1.5 truncate">{{ item.item_name }}</span>
							</div>
							<!-- Item status button -->
							<button
								v-if="item.status !== 'Complete'"
								@click="updateItemStatus(order, item)"
								:disabled="item._updating"
								:class="[
									'shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
									item.status === 'Order Placed'
										? 'bg-yellow-400 hover:bg-yellow-500 text-white'
										: 'bg-blue-500 hover:bg-blue-600 text-white',
								]"
							>
								{{ item._updating ? '...' : (item.status === 'Order Placed' ? __('Proses') : __('Selesai')) }}
							</button>
							<!-- Done indicator -->
							<span v-else class="shrink-0 text-xs font-semibold text-green-600 px-3 py-1.5 bg-green-100 rounded-lg">
								✓ Done
							</span>
						</div>
					</div>

					<!-- Remarks -->
					<p v-if="order.remarks" class="text-xs text-gray-400 italic mb-2 truncate">{{ order.remarks }}</p>

					<!-- Order-level action buttons -->
					<div class="flex gap-2 mt-2 pt-2 border-t border-gray-100">
						<button
							v-if="order.status === 'Order Placed'"
							@click="updateOrderStatus(order, 'On Progress')"
							:disabled="order._updating"
							class="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
						>
							{{ order._updating ? '...' : __('On Progress') }}
						</button>
						<button
							@click="updateOrderStatus(order, 'Complete')"
							:disabled="order._updating"
							:class="[
								'py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50',
								order.status === 'Order Placed'
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
		orders.value = (result || []).map((o) => ({
			...o,
			_updating: false,
			items: (o.items || []).map((i) => ({ ...i, _updating: false })),
		}))
	} catch (e) {
		showError(e.message || __("Gagal memuat order"))
	} finally {
		loading.value = false
	}
}

async function updateOrderStatus(order, status) {
	order._updating = true
	try {
		await call("pos_next.api.order_tracking.update_order_status", { name: order.name, status })
		if (status === "Complete") {
			orders.value = orders.value.filter((o) => o.name !== order.name)
		} else {
			order.status = status
			// Mark all Order Placed items as On Progress
			if (status === "On Progress") {
				for (const item of order.items) {
					if (item.status === "Order Placed") item.status = "On Progress"
				}
			}
			order._updating = false
		}
	} catch (e) {
		order._updating = false
		showError(e.message || __("Gagal update status"))
	}
}

async function updateItemStatus(order, item) {
	const nextStatus = item.status === "Order Placed" ? "On Progress" : "Complete"
	item._updating = true
	try {
		const res = await call("pos_next.api.order_tracking.update_item_status", {
			parent: order.name,
			child_name: item.name,
			status: nextStatus,
		})
		item.status = nextStatus
		item._updating = false

		if (res.order_complete) {
			orders.value = orders.value.filter((o) => o.name !== order.name)
		} else if (order.status === "Order Placed" && nextStatus !== "Order Placed") {
			order.status = "On Progress"
		}
	} catch (e) {
		item._updating = false
		showError(e.message || __("Gagal update item"))
	}
}

function formatTime(t) {
	if (!t) return ""
	const timePart = t.includes(" ") ? t.split(" ")[1] : t
	return timePart.substring(0, 5)
}

function handleNewOrder(data) {
	if (orders.value.some((o) => o.name === data.name)) return
	orders.value.push({
		...data,
		_updating: false,
		items: (data.items || []).map((i) => ({ ...i, _updating: false })),
	})
}

function handleCancelOrder(data) {
	orders.value = orders.value.filter((o) => o.sales_invoice !== data.invoice)
}

function handleStatusChanged(data) {
	if (data.status === "Complete") {
		orders.value = orders.value.filter((o) => o.name !== data.name)
	} else {
		const o = orders.value.find((o) => o.name === data.name)
		if (o) o.status = data.status
	}
}

function handleItemStatusChanged(data) {
	const order = orders.value.find((o) => o.name === data.parent)
	if (!order) return
	const item = order.items.find((i) => i.name === data.child_name)
	if (item) item.status = data.status
}

onMounted(() => {
	fetchOrders()
	window.frappe?.realtime?.on("new_order", handleNewOrder)
	window.frappe?.realtime?.on("cancel_order", handleCancelOrder)
	window.frappe?.realtime?.on("order_status_changed", handleStatusChanged)
	window.frappe?.realtime?.on("item_status_changed", handleItemStatusChanged)
})

onUnmounted(() => {
	window.frappe?.realtime?.off("new_order", handleNewOrder)
	window.frappe?.realtime?.off("cancel_order", handleCancelOrder)
	window.frappe?.realtime?.off("order_status_changed", handleStatusChanged)
	window.frappe?.realtime?.off("item_status_changed", handleItemStatusChanged)
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
</style>

<template>
	<div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div
			class="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
			@click.stop
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
				<h2 class="text-xl font-bold text-gray-900">{{ __('Sync Status') }}</h2>
				<button
					@click="$emit('close')"
					class="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
				>
					<XMarkIcon class="w-6 h-6" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- Overall Status -->
				<div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
					<div class="flex items-center gap-4">
						<div
							class="w-12 h-12 rounded-full flex items-center justify-center"
							:class="isOffline ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'"
						>
							<WifiIcon v-if="!isOffline" class="w-6 h-6" />
							<SignalSlashIcon v-else class="w-6 h-6" />
						</div>
						<div>
							<h3 class="font-bold text-gray-900">
								{{ isOffline ? __('Offline Mode') : __('Online') }}
							</h3>
							<p class="text-sm text-gray-500">
								{{
									isOffline
										? __('Working locally. Changes will sync when online.')
										: __('Connected to server. Real-time updates active.')
								}}
							</p>
						</div>
					</div>
					<button
						v-if="!isOffline"
						@click="handleSyncAll"
						:disabled="isSyncing"
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ArrowPathIcon class="w-4 h-4" :class="{ 'animate-spin': isSyncing }" />
						{{ isSyncing ? __('Syncing...') : __('Sync Now') }}
					</button>
				</div>

				<!-- Sync Items Grid -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Items Sync -->
					<div class="p-4 border border-gray-100 rounded-xl hover:border-blue-100 transition-colors">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<CubeIcon class="w-5 h-5 text-gray-400" />
								<span class="font-medium text-gray-900">{{ __('Items') }}</span>
							</div>
							<StatusBadge :status="getItemSyncStatus" />
						</div>
						<div class="text-sm text-gray-500">
							<p>{{ __('Cached:') }} <span class="font-mono font-medium text-gray-900">{{ formatNumber(cacheStats?.items || 0) }}</span></p>
							<p class="text-xs mt-1">{{ __('Last synced:') }} {{ formatLastSync(cacheStats?.lastSync) }}</p>
						</div>
						<button
							v-if="!isOffline"
							@click="handleSyncItems"
							:disabled="isSyncingItems"
							class="mt-3 w-full py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
						>
							{{ isSyncingItems ? __('Updating...') : __('Update Items') }}
						</button>
					</div>

					<!-- Customers Sync -->
					<div class="p-4 border border-gray-100 rounded-xl hover:border-blue-100 transition-colors">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<UserGroupIcon class="w-5 h-5 text-gray-400" />
								<span class="font-medium text-gray-900">{{ __('Customers') }}</span>
							</div>
							<StatusBadge :status="getCustomerSyncStatus" />
						</div>
						<div class="text-sm text-gray-500">
							<p>{{ __('Cached:') }} <span class="font-mono font-medium text-gray-900">{{ formatNumber(cacheStats?.customers || 0) }}</span></p>
							<p class="text-xs mt-1">{{ __('Last synced:') }} {{ formatLastSync(cacheStats?.customersLastSync) }}</p>
						</div>
						<button
							v-if="!isOffline"
							@click="handleSyncCustomers"
							:disabled="isSyncingCustomers"
							class="mt-3 w-full py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
						>
							{{ isSyncingCustomers ? __('Updating...') : __('Update Customers') }}
						</button>
					</div>
				</div>

				<!-- Pending Invoices -->
				<div v-if="pendingInvoicesCount > 0" class="p-4 bg-orange-50 border border-orange-100 rounded-xl">
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2">
							<DocumentTextIcon class="w-5 h-5 text-orange-500" />
							<span class="font-bold text-orange-900">{{ __('Pending Invoices') }}</span>
						</div>
						<span class="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
							{{ pendingInvoicesCount }}
						</span>
					</div>
					<p class="text-sm text-orange-700 mb-3">
						{{ __('These invoices are saved locally and waiting to be synced to the server.') }}
					</p>
					<button
						v-if="!isOffline"
						@click="handleSyncPending"
						:disabled="isSyncingPending"
						class="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
					>
						{{ isSyncingPending ? __('Syncing Invoices...') : __('Sync Pending Invoices') }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from "vue"
import {
	XMarkIcon,
	ArrowPathIcon,
	WifiIcon,
	SignalSlashIcon,
	CubeIcon,
	UserGroupIcon,
	DocumentTextIcon
} from "@heroicons/vue/24/outline"
import StatusBadge from "@/components/common/StatusBadge.vue"
import { useToast } from "@/composables/useToast"
import { offlineWorker } from "@/utils/offline/workerClient"

const props = defineProps({
	isOffline: Boolean,
	isSyncing: Boolean,
	cacheStats: Object,
	pendingInvoicesCount: Number,
	posProfile: String
})

const emit = defineEmits(["close", "sync-all", "items-synced", "customers-synced"])
const { showSuccess, showError } = useToast()

const isSyncingItems = ref(false)
const isSyncingCustomers = ref(false)
const isSyncingPending = ref(false)

const getItemSyncStatus = computed(() => {
	if (isSyncingItems.value) return 'syncing'
	if (props.cacheStats?.items > 0) return 'synced'
	return 'pending'
})

const getCustomerSyncStatus = computed(() => {
	if (isSyncingCustomers.value) return 'syncing'
	if (props.cacheStats?.customers > 0) return 'synced'
	return 'pending'
})

function formatNumber(num) {
	return (num || 0).toLocaleString()
}

function formatLastSync(timestamp) {
	if (!timestamp) return __('Never')
	return new Date(timestamp).toLocaleString()
}

async function handleSyncAll() {
	emit('sync-all')
}

async function handleSyncItems() {
	isSyncingItems.value = true
	try {
		// Logic to trigger item sync via worker
		await offlineWorker.cacheItemsFromServer(props.posProfile)
		showSuccess(__('Items updated successfully'))
		emit('items-synced')
	} catch (e) {
		showError(__('Failed to update items'))
	} finally {
		isSyncingItems.value = false
	}
}

async function handleSyncCustomers() {
	isSyncingCustomers.value = true
	try {
		await offlineWorker.cacheCustomersFromServer(props.posProfile)
		showSuccess(__('Customers updated successfully'))
		emit('customers-synced')
	} catch (e) {
		showError(__('Failed to update customers'))
	} finally {
		isSyncingCustomers.value = false
	}
}

async function handleSyncPending() {
	isSyncingPending.value = true
	try {
		await offlineWorker.syncOfflineInvoices()
		showSuccess(__('Pending invoices synced'))
	} catch (e) {
		showError(__('Failed to sync invoices'))
	} finally {
		isSyncingPending.value = false
	}
}
</script>

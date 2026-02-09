<template>
	<div class="flex flex-col h-full bg-gray-50">
		<!-- Header -->
		<div class="px-3 pt-3 pb-2 bg-white border-b border-gray-200">
			<h2 class="text-sm font-semibold text-gray-800">{{ __('Customer Database') }}</h2>
			<p class="text-xs text-gray-500">{{ __('Search online ERPNext records') }}</p>
		</div>

		<!-- Search Bar -->
		<div class="px-3 py-2 bg-white border-b border-gray-200">
			<div class="relative">
				<div class="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
					<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
				</div>
				<input
					v-model="searchTerm"
					@input="handleSearch"
					type="text"
					:placeholder="__('Search by name, phone, or email...')"
					class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 ps-9 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<button 
					v-if="searchTerm" 
					@click="clearSearch" 
					class="absolute inset-y-0 end-0 pe-2 text-gray-400 hover:text-gray-600"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>
			
			<div v-if="isOffline" class="mt-2 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200 flex items-center gap-1">
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
				</svg>
				{{ __('Online search requires internet connection') }}
			</div>
		</div>

		<!-- Results List -->
		<div class="flex-1 overflow-y-auto p-2">
			<!-- Loading State -->
			<div v-if="loading" class="flex justify-center items-center py-8">
				<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
				<span class="ms-2 text-xs text-gray-500">{{ __('Searching online...') }}</span>
			</div>

			<!-- Empty State -->
			<div v-else-if="!searchTerm" class="text-center py-10 opacity-60">
				<svg class="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
				</svg>
				<p class="mt-2 text-sm text-gray-500">{{ __('Start typing to search customers') }}</p>
			</div>

			<!-- No Results -->
			<div v-else-if="customers.length === 0" class="text-center py-10">
				<p class="text-sm font-medium text-gray-700">{{ __('No records found') }}</p>
				<p class="text-xs text-gray-500 mt-1">{{ __('Try different keywords') }}</p>
			</div>

			<!-- Customer List -->
			<div v-else class="space-y-2">
				<button
					v-for="customer in customers"
					:key="customer.name"
					@click="handleSelect(customer)"
					class="w-full text-left bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all duration-150 group"
				>
					<div class="flex justify-between items-start">
						<div>
							<h3 class="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
								{{ customer.customer_name }}
							</h3>
							
							<div class="mt-1 space-y-0.5">
								<p v-if="customer.mobile_no" class="text-xs text-gray-500 flex items-center gap-1.5">
									<svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
									</svg>
									{{ customer.mobile_no }}
								</p>
								<p v-if="customer.email_id" class="text-xs text-gray-500 flex items-center gap-1.5">
									<svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
									</svg>
									{{ customer.email_id }}
								</p>
							</div>
						</div>
						
						<!-- Loyalty Badge if points exist -->
						<div v-if="customer.loyalty_program" class="shrink-0 flex flex-col items-end">
							<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
								👑 {{ __('Loyalty') }}
							</span>
						</div>
					</div>
				</button>
			</div>
		</div>
	</div>

	<!-- Details Dialog -->
	<CustomerDetailsDialog
		v-if="selectedCustomer"
		v-model="showDetails"
		:customer="selectedCustomer"
		@select="confirmSelection"
	/>
</template>

<script setup>
import { ref, computed } from 'vue'
import { debounce } from 'frappe-ui'
import { useCustomerSearchStore } from '@/stores/customerSearch'
import { isOffline as getIsOffline } from '@/utils/offline'
import CustomerDetailsDialog from './CustomerDetailsDialog.vue'

const props = defineProps({
	posProfile: String,
})

const emit = defineEmits(['customer-selected'])

const customerStore = useCustomerSearchStore()
const searchTerm = ref('')
const customers = ref([])
const loading = ref(false)
const isOffline = computed(() => getIsOffline())

// Details Dialog State
const showDetails = ref(false)
const selectedCustomer = ref(null)

const handleSearch = debounce(async (e) => {
	const term = e.target.value
	if (!term || term.length < 2) {
		customers.value = []
		return
	}

	if (isOffline.value) return

	loading.value = true
	try {
		// Use the new online-only search action
		const results = await customerStore.searchOnlineCustomers(term, props.posProfile)
		customers.value = results
	} catch (error) {
		console.error("Search failed:", error)
		customers.value = []
	} finally {
		loading.value = false
	}
}, 300)

function clearSearch() {
	searchTerm.value = ''
	customers.value = []
}

function handleSelect(customer) {
	selectedCustomer.value = customer
	showDetails.value = true
}

function confirmSelection(customer) {
	emit('customer-selected', customer)
	showDetails.value = false
	// Optional: Clear search after selection? kept for context
}
</script>

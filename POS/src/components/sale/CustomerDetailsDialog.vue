<template>
	<Dialog v-model="show" :options="{ title: __('Customer Details'), size: 'md' }">
		<template #body-content>
			<div class="space-y-4">
				<div class="flex items-center space-x-4">
					<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
						<span class="text-2xl font-bold text-gray-400">{{ customerNameInitials }}</span>
					</div>
					<div>
						<h2 class="text-lg font-bold text-gray-900">{{ customer.customer_name }}</h2>
						<p class="text-sm text-gray-500">{{ customer.name }}</p>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-xs font-medium text-gray-500 uppercase">{{ __('Mobile') }}</label>
						<p class="mt-1 text-sm text-gray-900">{{ customer.mobile_no || '-' }}</p>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-500 uppercase">{{ __('Email') }}</label>
						<p class="mt-1 text-sm text-gray-900">{{ customer.email_id || '-' }}</p>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-500 uppercase">{{ __('Group') }}</label>
						<p class="mt-1 text-sm text-gray-900">{{ customer.customer_group || '-' }}</p>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-500 uppercase">{{ __('Tax ID') }}</label>
						<p class="mt-1 text-sm text-gray-900">{{ customer.tax_id || '-' }}</p>
					</div>
				</div>

				<!-- Loyalty Section -->
				<div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
					<div class="flex justify-between items-center">
						<h3 class="text-sm font-bold text-blue-900">{{ __('Loyalty Points') }}</h3>
						<span v-if="loadingLoyalty" class="text-xs text-blue-500 animate-pulse">{{ __('Checking balance...') }}</span>
					</div>
					
					<div v-if="!loadingLoyalty" class="mt-2 flex items-baseline">
						<span class="text-2xl font-bold text-blue-600">{{ loyaltyPoints }}</span>
						<span class="ms-1 text-sm text-blue-500">{{ __('Points') }}</span>
					</div>
					
					<p v-if="loyaltyProgram" class="mt-1 text-xs text-blue-400">
						{{ __('Program: {0}', [loyaltyProgram]) }}
					</p>
				</div>

			</div>
		</template>

		<template #actions>
			<Button variant="subtle" @click="show = false">{{ __('Cancel') }}</Button>
			<Button variant="solid" @click="confirmSelect">{{ __('Select Customer') }}</Button>
		</template>
	</Dialog>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { Dialog, Button } from 'frappe-ui'
import { call } from '@/utils/apiWrapper'

const props = defineProps({
	modelValue: Boolean,
	customer: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['update:modelValue', 'select'])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const customerNameInitials = computed(() => {
	if (!props.customer?.customer_name) return '?'
	return props.customer.customer_name
		.split(' ')
		.map(n => n[0])
		.slice(0, 2)
		.join('')
		.toUpperCase()
})

const loadingLoyalty = ref(false)
const loyaltyPoints = ref(0)
const loyaltyProgram = ref('')

watch(() => props.customer, async (newCustomer) => {
	if (newCustomer) {
		await fetchLoyaltyDetails(newCustomer.name)
	}
}, { immediate: true })

async function fetchLoyaltyDetails(customerName) {
	loadingLoyalty.value = true
	try {
		// Fetch loyalty points using frappe.client.get_value or specific method
		// Assuming standard ERPNext structure or using get_customer_details
		// For now, let's fetch the full customer doc to be safe
		const customerDoc = await call('frappe.client.get', {
			doctype: 'Customer',
			name: customerName
		})

		if (customerDoc) {
			loyaltyPoints.value = customerDoc.loyalty_program_details?.loyalty_points || 0
			// Alternatively check simplified field if present
			if (!loyaltyPoints.value && customerDoc.loyalty_points) {
				loyaltyPoints.value = customerDoc.loyalty_points
			}
			
			loyaltyProgram.value = customerDoc.loyalty_program || ''
		}
	} catch (error) {
		console.error('Failed to fetch loyalty details:', error)
		loyaltyPoints.value = 0
		loyaltyProgram.value = ''
	} finally {
		loadingLoyalty.value = false
	}
}

function confirmSelect() {
	emit('select', props.customer) // Pass original customer object (or enriched one if we stored it)
}
</script>

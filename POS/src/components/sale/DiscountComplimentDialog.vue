<template>
	<Dialog
		v-model="show"
		:options="{ title: __('Apply Check / Compliment'), size: 'sm' }"
	>
		<template #body-content>
			<div class="space-y-4">
				<!-- Tabs -->
				<div class="flex p-1 space-x-1 bg-gray-100/80 rounded-xl">
					<button
						v-for="tab in tabs"
						:key="tab.value"
						@click="activeTab = tab.value"
						:class="[
							'w-full py-2.5 text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200',
							activeTab === tab.value
								? 'bg-white shadow text-gray-900 scale-[1.02]'
								: 'text-gray-500 hover:text-gray-700 hover:bg-white/[0.12]'
						]"
					>
						{{ __(tab.label) }}
					</button>
				</div>

				<!-- Discount Content -->
				<div v-if="activeTab === 'discount'" class="space-y-4">
					<div class="space-y-2">
						<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ __('Discount Value') }}</label>
						<div class="flex rounded-lg shadow-sm">
							<div class="relative flex-grow focus-within:z-10">
								<input
									type="number"
									v-model.number="discountValue"
									:max="discountType === 'Percentage' ? 100 : subtotal"
									min="0"
									class="block w-full rounded-none rounded-l-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-lg font-bold py-3 pl-4"
									placeholder="0"
								/>
							</div>
							<button
								@click="toggleDiscountType"
								class="-ml-px relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-lg text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-24 justify-center"
							>
								{{ discountType === 'Percentage' ? '%' : currencySymbol }}
							</button>
						</div>
						<p class="text-xs text-gray-500 text-right">
							{{ __('Calculated Discount') }}: <span class="font-bold text-gray-900">{{ formatCurrency(calculatedAmount) }}</span>
						</p>
					</div>
				</div>

				<!-- Compliment Content -->
				<div v-else class="space-y-4">
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
						<div class="flex-shrink-0">
							<svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div>
							<h3 class="text-sm font-medium text-blue-800">{{ __('Full Compliment') }}</h3>
							<div class="mt-1 text-sm text-blue-700">
								{{ __('This will apply a 100% discount to the entire order.') }}
							</div>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ __('Reason (Optional)') }}</label>
						<textarea
							v-model="complimentReason"
							rows="3"
							class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-lg"
							:placeholder="__('e.g. Owner guest, Staff meal...')"
						></textarea>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3 pt-4 border-t border-gray-100">
					<Button
						variant="subtle"
						class="w-full"
						@click="closeDialog"
					>
						{{ __('Cancel') }}
					</Button>
					<Button
						v-if="activeTab === 'discount'"
						variant="solid"
						class="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-[0.98]"
						@click="applyDiscount"
						:loading="loading"
					>
						{{ __('Apply Discount') }}
					</Button>
					<Button
						v-else
						variant="solid"
						class="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-[0.98]"
						@click="applyCompliment"
						:loading="loading"
					>
						{{ __('Apply Compliment') }}
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Dialog, Button } from 'frappe-ui'
import { usePOSCartStore } from '@/stores/posCart'
import { usePOSSettingsStore } from '@/stores/posSettings'
import { formatCurrency, roundCurrency } from '@/utils/currency'

const props = defineProps(['modelValue', 'subtotal'])
const emit = defineEmits(['update:modelValue', 'apply'])

const cartStore = usePOSCartStore()
const settingsStore = usePOSSettingsStore()

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const tabs = [
	{ label: 'Discount', value: 'discount' },
	{ label: 'Compliment', value: 'compliment' }
]

const activeTab = ref('discount')
const discountValue = ref(0)
const discountType = ref('Percentage') // 'Percentage' or 'Amount'
const complimentReason = ref('')
const loading = ref(false)

const currencySymbol = computed(() => settingsStore.currencySymbol || '$')

const calculatedAmount = computed(() => {
	if (activeTab.value === 'compliment') {
		return props.subtotal
	}
	
	if (discountType.value === 'Percentage') {
		return roundCurrency((props.subtotal * discountValue.value) / 100)
	} else {
		return roundCurrency(discountValue.value)
	}
})

function toggleDiscountType() {
	discountType.value = discountType.value === 'Percentage' ? 'Amount' : 'Percentage'
	discountValue.value = 0
}

function closeDialog() {
	show.value = false
}

function applyDiscount() {
	loading.value = true
	try {
		const discount = {
			percentage: discountType.value === 'Percentage' ? discountValue.value : 0,
			amount: discountType.value === 'Amount' ? discountValue.value : 0,
			name: 'Manual Discount',
			code: 'MANUAL'
		}
		
		cartStore.applyDiscount(discount)
		emit('apply')
		closeDialog()
	} catch (e) {
		console.error(e)
	} finally {
		loading.value = false
	}
}

function applyCompliment() {
	loading.value = true
	try {
		const discount = {
			percentage: 100, // 100% discount
			amount: 0,
			name: 'Compliment',
			code: 'COMPLIMENT',
			description: complimentReason.value
		}
		
		cartStore.applyDiscount(discount)
		// Optionally update remarks if you have a way to do so in store, e.g.:
		// cartStore.setRemarks(complimentReason.value ? `Compliment: ${complimentReason.value}` : 'Compliment')
		
		emit('apply')
		closeDialog()
	} catch (e) {
		console.error(e)
	} finally {
		loading.value = false
	}
}

// Reset when opened
watch(show, (val) => {
	if (val) {
		activeTab.value = 'discount'
		discountValue.value = 0
		complimentReason.value = ''
	}
})
</script>

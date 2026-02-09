<template>
	<Dialog
		v-model="show"
		:options="{ title: __('Apply Check / Compliment'), size: 'md' }"
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
							'w-1/2 py-2.5 text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200',
							activeTab === tab.value
								? 'bg-white shadow text-gray-900 scale-[1.02]'
								: 'text-gray-500 hover:text-gray-700 hover:bg-white/[0.12]'
						]"
					>
						{{ __(tab.label) }}
					</button>
				</div>

				<!-- Content Area -->
				<div>
					<!-- Discount Content -->
					<div v-show="activeTab === 'discount'" class="space-y-4">
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
								{{ __('Calculated Discount') }}: <span class="font-bold text-gray-900">{{ formatCurrency(calculatedDiscountAmount) }}</span>
							</p>
						</div>
					</div>

					<!-- Compliment Content -->
					<div v-show="activeTab === 'compliment'" class="space-y-4">
						<div class="space-y-2">
							<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ __('Compliment Value') }}</label>
							<div class="flex rounded-lg shadow-sm">
								<div class="relative flex-grow focus-within:z-10">
									<input
										type="number"
										v-model.number="complimentValue"
										:max="complimentType === 'Percentage' ? 100 : subtotal"
										min="0"
										class="block w-full rounded-none rounded-l-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-lg font-bold py-3 pl-4"
										placeholder="0"
									/>
								</div>
								<button
									@click="toggleComplimentType"
									class="-ml-px relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-lg text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-24 justify-center"
								>
									{{ complimentType === 'Percentage' ? '%' : currencySymbol }}
								</button>
							</div>
							<p class="text-xs text-gray-500 text-right">
								{{ __('Calculated Compliment') }}: <span class="font-bold text-gray-900">{{ formatCurrency(calculatedComplimentAmount) }}</span>
							</p>
						</div>

						<div class="space-y-2">
							<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ __('Reason (Optional)') }}</label>
							<textarea
								v-model="complimentReason"
								rows="3"
								class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5"
								:placeholder="__('e.g. Owner guest, Staff meal...')"
							></textarea>
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3 pt-6 mt-2 border-t border-gray-100">
					<Button
						variant="subtle"
						class="flex-1"
						size="lg"
						@click="closeDialog"
					>
						{{ __('Cancel') }}
					</Button>
					<Button
						variant="solid"
						class="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-[0.98]"
						size="lg"
						@click="handleApply"
						:loading="loading"
					>
						{{ activeTab === 'discount' ? __('Apply Discount') : __('Apply Compliment') }}
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
const loading = ref(false)

// Discount State
const discountValue = ref(0)
const discountType = ref('Percentage')

// Compliment State
const complimentValue = ref(0)
const complimentType = ref('Percentage')
const complimentReason = ref('')

const currencySymbol = computed(() => settingsStore.currencySymbol || '$')

const calculatedDiscountAmount = computed(() => {
	if (discountType.value === 'Percentage') {
		return roundCurrency((props.subtotal * discountValue.value) / 100)
	} else {
		return roundCurrency(discountValue.value)
	}
})

const calculatedComplimentAmount = computed(() => {
	if (complimentType.value === 'Percentage') {
		return roundCurrency((props.subtotal * complimentValue.value) / 100)
	} else {
		return roundCurrency(complimentValue.value)
	}
})

function toggleDiscountType() {
	discountType.value = discountType.value === 'Percentage' ? 'Amount' : 'Percentage'
	discountValue.value = 0
}

function toggleComplimentType() {
	complimentType.value = complimentType.value === 'Percentage' ? 'Amount' : 'Percentage'
	complimentValue.value = 0
}

function closeDialog() {
	show.value = false
}

function handleApply() {
	if (activeTab.value === 'discount') {
		applyDiscount()
	} else {
		applyCompliment()
	}
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
		

		cartStore.applyDiscountToCart(discount)
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
			percentage: complimentType.value === 'Percentage' ? complimentValue.value : 0,
			amount: complimentType.value === 'Amount' ? complimentValue.value : 0,
			name: 'Compliment',
			code: 'COMPLIMENT',
			description: complimentReason.value
		}
		
		cartStore.applyDiscountToCart(discount)
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
		
		// Reset compliment state
		complimentValue.value = 0
		complimentReason.value = ''
		complimentType.value = 'Percentage'
	}
})
</script>

<template>
	<Teleport to="body">
		<Transition name="dialog">
			<div
				v-if="warning"
				class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] px-4"
				@click.self="warning.onCancel()"
			>
				<Transition name="dialog-content">
					<div
						v-if="warning"
						class="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
					>
						<!-- Header -->
						<div class="flex items-start gap-3 px-5 pt-5 pb-3">
							<div class="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
								<svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
										d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
								</svg>
							</div>
							<div>
								<h3 class="text-base font-semibold text-gray-900">{{ __('Peringatan Harga') }}</h3>
								<p class="mt-1 text-sm text-gray-600 leading-snug">
									{{ __('Harga jual') }}
									<span class="font-medium text-gray-900">{{ warning.item_name }}</span>
									(<span class="text-red-600 font-semibold">{{ formatCurrency(warning.rate) }}</span>)
									{{ __('lebih rendah dari harga pokok') }}
									(<span class="font-semibold">{{ formatCurrency(warning.valuation_rate) }}</span>).
									{{ __('Lanjutkan?') }}
								</p>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex gap-2 px-5 pb-5 pt-2">
							<button
								class="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
								@click="warning.onCancel()"
							>
								{{ __('Batal') }}
							</button>
							<button
								class="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold transition-colors"
								@click="warning.onConfirm()"
							>
								{{ __('Lanjutkan') }}
							</button>
						</div>
					</div>
				</Transition>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency"
import { usePOSCartStore } from "@/stores/posCart"
import { computed } from "vue"

const cartStore = usePOSCartStore()
const warning = computed(() => cartStore.valuationWarning)

function formatCurrency(amount) {
	return formatCurrencyUtil(Number.parseFloat(amount || 0))
}
</script>

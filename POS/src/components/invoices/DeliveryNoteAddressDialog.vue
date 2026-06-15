<template>
	<Dialog
		v-model="show"
		:options="{ title: __('Buat Delivery Note'), size: 'md' }"
	>
		<template #body-content>
			<div class="space-y-4">
				<p class="text-sm text-gray-600">
					{{ __('Masukkan alamat pengiriman untuk invoice {0}.', [invoiceName]) }}
				</p>
				<div class="space-y-2">
					<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">
						{{ __('Alamat Pengiriman') }}
					</label>
					<textarea
						v-model="shippingAddress"
						rows="4"
						class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5"
						:placeholder="__('Nama penerima, alamat lengkap, kota, kode pos...')"
					></textarea>
				</div>
			</div>
			<div class="flex gap-3 pt-6 mt-2 border-t border-gray-100">
				<Button
					variant="subtle"
					class="flex-1"
					size="lg"
					@click="show = false"
				>
					{{ __('Cancel') }}
				</Button>
				<Button
					variant="solid"
					class="flex-1"
					size="lg"
					:disabled="!shippingAddress.trim()"
					:loading="loading"
					@click="handleConfirm"
				>
					{{ __('Buat Delivery Note') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch } from "vue"
import { Dialog, Button } from "frappe-ui"

const props = defineProps({
	modelValue: Boolean,
	invoiceName: { type: String, default: "" },
	loading: { type: Boolean, default: false },
})
const emit = defineEmits(["update:modelValue", "confirm"])

const show = ref(props.modelValue)
const shippingAddress = ref("")

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) shippingAddress.value = ""
})
watch(show, (val) => emit("update:modelValue", val))

function handleConfirm() {
	const address = shippingAddress.value.trim()
	if (!address) return
	emit("confirm", address)
}
</script>

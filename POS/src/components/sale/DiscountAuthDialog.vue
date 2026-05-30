<template>
	<Dialog v-model="show" :options="{ title: __('Discount Authorization'), size: 'sm' }">
		<template #body-content>
			<div class="px-4 pb-4">
				<!-- Icon + desc -->
				<div class="flex flex-col items-center mb-4">
					<div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
						<LockClosedIcon class="w-6 h-6 text-orange-500" />
					</div>
					<p class="text-sm text-gray-500 text-center">{{ __('Enter password to apply discount') }}</p>
				</div>

				<!-- Input -->
				<div class="relative mb-1">
					<input
						ref="inputRef"
						v-model="password"
						:type="showPassword ? 'text' : 'password'"
						:placeholder="__('Password')"
						@keyup.enter="verify"
						@keyup.esc="cancel"
						class="w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
						:class="error ? 'border-red-400 bg-red-50' : 'border-gray-300'"
					/>
					<button
						@click="showPassword = !showPassword"
						class="absolute inset-y-0 end-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
						tabindex="-1"
						type="button"
					>
						<EyeIcon v-if="!showPassword" class="w-4 h-4" />
						<EyeSlashIcon v-else class="w-4 h-4" />
					</button>
				</div>
				<p v-if="error" class="text-xs text-red-500 mb-3 text-center">{{ error }}</p>

				<!-- Actions -->
				<div class="flex gap-3 mt-4">
					<button
						@click="cancel"
						class="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
						type="button"
					>
						{{ __('Cancel') }}
					</button>
					<button
						@click="verify"
						:disabled="!password || verifying"
						class="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
						type="button"
					>
						<span v-if="verifying" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
						{{ verifying ? __('Verifying...') : __('Confirm') }}
					</button>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from "vue"
import { Dialog } from "frappe-ui"
import { LockClosedIcon, EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline"

const props = defineProps({
	modelValue: Boolean,
	correctPassword: { type: String, default: "" },
})
const emit = defineEmits(["update:modelValue", "authorized"])

const password = ref("")
const showPassword = ref(false)
const verifying = ref(false)
const error = ref("")
const inputRef = ref(null)

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

watch(() => props.modelValue, async (val) => {
	if (val) {
		password.value = ""
		showPassword.value = false
		error.value = ""
		await nextTick()
		inputRef.value?.focus()
	}
})

function cancel() {
	emit("update:modelValue", false)
}

async function verify() {
	if (!password.value) return
	verifying.value = true
	error.value = ""

	await new Promise((r) => setTimeout(r, 150))

	if (password.value === props.correctPassword) {
		emit("authorized")
		emit("update:modelValue", false)
	} else {
		error.value = __("Incorrect password. Please try again.")
		password.value = ""
		await nextTick()
		inputRef.value?.focus()
	}

	verifying.value = false
}
</script>

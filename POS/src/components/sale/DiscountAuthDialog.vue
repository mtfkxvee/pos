<template>
	<Transition name="fade">
		<div v-if="modelValue" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
			<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
				<!-- Header -->
				<div class="px-6 pt-6 pb-4 text-center">
					<div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
						<LockClosedIcon class="w-6 h-6 text-orange-500" />
					</div>
					<h2 class="text-lg font-semibold text-gray-900">{{ __('Discount Authorization') }}</h2>
					<p class="text-sm text-gray-500 mt-1">{{ __('Enter password to apply discount') }}</p>
				</div>

				<!-- Input -->
				<div class="px-6 pb-2">
					<div class="relative">
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
						>
							<EyeIcon v-if="!showPassword" class="w-4 h-4" />
							<EyeSlashIcon v-else class="w-4 h-4" />
						</button>
					</div>
					<p v-if="error" class="text-xs text-red-500 mt-1.5 text-center">{{ error }}</p>
				</div>

				<!-- Actions -->
				<div class="flex gap-3 px-6 py-4">
					<button
						@click="cancel"
						class="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
					>
						{{ __('Cancel') }}
					</button>
					<button
						@click="verify"
						:disabled="!password || verifying"
						class="flex-1 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
					>
						<span v-if="verifying" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
						{{ verifying ? __('Verifying...') : __('Confirm') }}
					</button>
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, watch, nextTick } from "vue"
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

	// Small delay for UX feedback
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

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

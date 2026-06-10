<template>
	<Dialog v-model="show" :options="{ title: __('Speed Mode Access Code'), size: 'sm' }">
		<template #body-content>
			<div class="flex flex-col gap-3">
				<p class="text-sm text-gray-600">
					{{ __("Enter the access code to activate Speed Mode.") }}
				</p>
				<Input
					ref="codeInput"
					v-model="code"
					type="password"
					inputmode="numeric"
					:placeholder="__('Access code')"
					@keyup.enter="handleConfirm"
				/>
				<p v-if="error" class="text-sm text-red-600">
					{{ __("Incorrect access code.") }}
				</p>
			</div>
		</template>
		<template #actions>
			<div class="flex gap-2">
				<Button variant="solid" @click="handleConfirm">
					{{ __("Confirm") }}
				</Button>
				<Button variant="subtle" @click="show = false">
					{{ __("Cancel") }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
// Trial-only PIN gate for Speed Mode activation. Hardcoded on the frontend
// only - never sent to the backend or logged. Per the user, this access code
// is temporary and may be removed in a future revision.
const ACCESS_CODE = "233343"

import { Button, Dialog, Input } from "frappe-ui"
import { computed, ref, watch } from "vue"

const props = defineProps({
	modelValue: Boolean,
})

const emit = defineEmits(["update:modelValue", "verified"])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const code = ref("")
const error = ref(false)

watch(show, (val) => {
	if (val) {
		code.value = ""
		error.value = false
	}
})

function handleConfirm() {
	if (code.value === ACCESS_CODE) {
		error.value = false
		code.value = ""
		show.value = false
		emit("verified")
	} else {
		error.value = true
	}
}
</script>

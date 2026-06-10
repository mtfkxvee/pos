<template>
	<Dialog v-model="show" :options="{ title: __('Activate Speed Mode'), size: 'lg' }">
		<template #body-content>
			<div class="flex flex-col gap-4">
				<p class="text-sm text-gray-600">
					{{ __("Speed Mode switches the POS to offline mode for faster checkout. Review what works before continuing.") }}
				</p>

				<div>
					<h4 class="text-sm font-semibold text-green-700 mb-2">
						{{ __("Works in Speed Mode") }}
					</h4>
					<ul class="list-disc ps-5 text-sm text-gray-700 flex flex-col gap-1">
						<li v-for="(line, i) in worksItems" :key="`works-${i}`">{{ line }}</li>
					</ul>
				</div>

				<div>
					<h4 class="text-sm font-semibold text-red-700 mb-2">
						{{ __("Does NOT work in Speed Mode") }}
					</h4>
					<ul class="list-disc ps-5 text-sm text-gray-700 flex flex-col gap-1">
						<li v-for="(line, i) in doesNotWorkItems" :key="`nowork-${i}`">{{ line }}</li>
					</ul>
				</div>

				<p class="text-xs text-gray-500">
					{{ __("Pending sales will sync automatically and the catalog/customer/promotion data will refresh in the background after every 10 transactions.") }}
				</p>
			</div>
		</template>
		<template #actions>
			<div class="flex gap-2">
				<Button variant="solid" @click="handleConfirm">
					{{ __("Activate Speed Mode") }}
				</Button>
				<Button variant="subtle" @click="show = false">
					{{ __("Cancel") }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import {
	SPEED_MODE_WORKS,
	SPEED_MODE_DOES_NOT_WORK,
} from "@/composables/useSpeedModeReadiness"
import { Button, Dialog } from "frappe-ui"
import { computed } from "vue"

const props = defineProps({
	modelValue: Boolean,
})

const emit = defineEmits(["update:modelValue", "confirm"])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const worksItems = SPEED_MODE_WORKS
const doesNotWorkItems = SPEED_MODE_DOES_NOT_WORK

function handleConfirm() {
	show.value = false
	emit("confirm")
}
</script>

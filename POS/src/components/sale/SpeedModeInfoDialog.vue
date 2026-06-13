<template>
	<Dialog v-model="show" :options="{ title: __('Aktifkan Speed Mode'), size: 'lg' }">
		<template #body-content>
			<div class="flex flex-col gap-4">
				<p class="text-sm text-gray-600">
					{{ __("Speed Mode mengalihkan POS ke mode offline untuk transaksi yang lebih cepat. Tinjau dulu apa saja yang berfungsi sebelum melanjutkan.") }}
				</p>

				<div>
					<h4 class="text-sm font-semibold text-green-700 mb-2">
						{{ __("Yang berfungsi di Speed Mode") }}
					</h4>
					<ul class="list-disc ps-5 text-sm text-gray-700 flex flex-col gap-1">
						<li v-for="(line, i) in worksItems" :key="`works-${i}`">{{ line }}</li>
					</ul>
				</div>

				<div>
					<h4 class="text-sm font-semibold text-red-700 mb-2">
						{{ __("Yang TIDAK berfungsi di Speed Mode") }}
					</h4>
					<ul class="list-disc ps-5 text-sm text-gray-700 flex flex-col gap-1">
						<li v-for="(line, i) in doesNotWorkItems" :key="`nowork-${i}`">{{ line }}</li>
					</ul>
				</div>

				<p class="text-xs text-gray-500">
					{{ __("Transaksi yang tertunda akan otomatis tersinkron, dan data katalog/pelanggan/promo akan diperbarui di latar belakang setiap 10 transaksi.") }}
				</p>
			</div>
		</template>
		<template #actions>
			<div class="flex gap-2">
				<Button variant="solid" @click="handleConfirm">
					{{ __("Aktifkan Speed Mode") }}
				</Button>
				<Button variant="subtle" @click="show = false">
					{{ __("Batal") }}
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

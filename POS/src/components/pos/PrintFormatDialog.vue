<template>
	<teleport to="body">
		<transition name="overlay-fade">
			<div
				v-if="modelValue"
				class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
				role="dialog"
				aria-modal="true"
				aria-labelledby="print-format-title"
			>
				<!-- Backdrop -->
				<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

				<!-- Dialog -->
				<div
					class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
				>
					<!-- Header -->
					<div class="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white text-center">
						<div class="flex justify-center mb-3">
							<div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
								<svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
									<path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
								</svg>
							</div>
						</div>
						<h2 id="print-format-title" class="text-lg font-bold">{{ __('Pilih Ukuran Kertas') }}</h2>
						<p class="text-blue-100 text-sm mt-1">{{ __('Mode offline aktif. Pilih ukuran struk printer thermal.') }}</p>
					</div>

					<!-- Options -->
					<div class="p-6 flex gap-4">
						<!-- 58mm Option -->
						<button
							@click="select('58 PRINTER')"
							:class="[
								'flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 active:scale-95',
								currentFormat === '58 PRINTER'
									? 'border-blue-500 bg-blue-50 text-blue-700'
									: 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
							]"
						>
							<!-- Paper icon 58mm -->
							<div class="relative">
								<svg class="w-10 h-14" viewBox="0 0 40 56" fill="none">
									<rect x="4" y="2" width="24" height="52" rx="2" :fill="currentFormat === '58 PRINTER' ? '#EFF6FF' : '#F9FAFB'" :stroke="currentFormat === '58 PRINTER' ? '#3B82F6' : '#D1D5DB'" stroke-width="2"/>
									<rect x="8" y="8" width="16" height="1.5" rx="0.75" :fill="currentFormat === '58 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="8" y="12" width="16" height="1.5" rx="0.75" :fill="currentFormat === '58 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="8" y="16" width="12" height="1.5" rx="0.75" :fill="currentFormat === '58 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="8" y="22" width="16" height="8" rx="1" :fill="currentFormat === '58 PRINTER' ? '#BFDBFE' : '#E5E7EB'"/>
									<rect x="8" y="34" width="16" height="1.5" rx="0.75" :fill="currentFormat === '58 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="8" y="38" width="10" height="1.5" rx="0.75" :fill="currentFormat === '58 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
								</svg>
								<div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
									:class="currentFormat === '58 PRINTER' ? 'bg-blue-500' : 'bg-gray-400'">
									✓
								</div>
							</div>
							<div class="text-center">
								<div class="text-xl font-bold">58mm</div>
								<div class="text-xs text-gray-500 mt-0.5">{{ __('Kertas sempit') }}</div>
							</div>
						</button>

						<!-- 80mm Option -->
						<button
							@click="select('80 PRINTER')"
							:class="[
								'flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 active:scale-95',
								currentFormat === '80 PRINTER'
									? 'border-blue-500 bg-blue-50 text-blue-700'
									: 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
							]"
						>
							<!-- Paper icon 80mm -->
							<div class="relative">
								<svg class="w-14 h-14" viewBox="0 0 56 56" fill="none">
									<rect x="2" y="2" width="36" height="52" rx="2" :fill="currentFormat === '80 PRINTER' ? '#EFF6FF' : '#F9FAFB'" :stroke="currentFormat === '80 PRINTER' ? '#3B82F6' : '#D1D5DB'" stroke-width="2"/>
									<rect x="7" y="8" width="26" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="7" y="12" width="26" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="7" y="16" width="18" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="7" y="22" width="26" height="8" rx="1" :fill="currentFormat === '80 PRINTER' ? '#BFDBFE' : '#E5E7EB'"/>
									<rect x="7" y="34" width="26" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="7" y="38" width="18" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
									<rect x="7" y="42" width="22" height="1.5" rx="0.75" :fill="currentFormat === '80 PRINTER' ? '#93C5FD' : '#E5E7EB'"/>
								</svg>
								<div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
									:class="currentFormat === '80 PRINTER' ? 'bg-blue-500' : 'bg-gray-400'">
									✓
								</div>
							</div>
							<div class="text-center">
								<div class="text-xl font-bold">80mm</div>
								<div class="text-xs text-gray-500 mt-0.5">{{ __('Kertas lebar') }}</div>
							</div>
						</button>
					</div>

					<!-- Footer -->
					<div class="px-6 pb-6">
						<button
							@click="confirm"
							:disabled="!selectedFormat"
							:class="[
								'w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200',
								selectedFormat
									? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md hover:shadow-lg'
									: 'bg-gray-100 text-gray-400 cursor-not-allowed'
							]"
						>
							{{ __('Konfirmasi') }}
						</button>
					</div>
				</div>
			</div>
		</transition>
	</teleport>
</template>

<script setup>
import { ref, watch } from "vue"

const props = defineProps({
	modelValue: {
		type: Boolean,
		default: false,
	},
	currentFormat: {
		type: String,
		default: null,
	},
})

const emit = defineEmits(["update:modelValue", "format-selected"])

const selectedFormat = ref(props.currentFormat)

watch(
	() => props.currentFormat,
	(val) => {
		selectedFormat.value = val
	},
)

function select(format) {
	selectedFormat.value = format
}

function confirm() {
	if (!selectedFormat.value) return
	emit("format-selected", selectedFormat.value)
	emit("update:modelValue", false)
}
</script>

<style scoped>
.overlay-fade-enter-active,
.overlay-fade-leave-active {
	transition: opacity 0.2s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
	opacity: 0;
}
.overlay-fade-enter-active > div:last-child,
.overlay-fade-leave-active > div:last-child {
	transition: transform 0.2s ease, opacity 0.2s ease;
}
.overlay-fade-enter-from > div:last-child,
.overlay-fade-leave-to > div:last-child {
	transform: scale(0.95);
	opacity: 0;
}
</style>

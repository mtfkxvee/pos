<template>
	<Teleport to="body">
		<Transition name="overlay">
			<div
				v-if="show"
				class="fixed inset-0 z-[9999] flex items-center justify-center"
			>
				<!-- Backdrop -->
				<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

				<!-- Content Card -->
				<div class="relative z-10">
					<Transition name="card" mode="out-in">
						<div
							v-if="!isRefreshing"
							key="confirm"
							class="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 transform"
						>
							<!-- Icon -->
							<div class="flex justify-center mb-6">
								<div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
									<svg
										class="w-10 h-10 text-blue-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
								</div>
							</div>

							<!-- Title & Message -->
							<h3 class="text-2xl font-bold text-gray-900 text-center mb-3">
								{{ __('Update Tersedia') }}
							</h3>
							<p class="text-gray-600 text-center mb-2 leading-relaxed">
								{{ __('Sistem POS telah diperbarui ke versi terbaru. Selesaikan transaksi yang sedang berjalan, lalu refresh untuk melanjutkan.') }}
							</p>
							<p class="text-gray-400 text-center text-xs mb-8">
								{{ __('Transaksi baru tidak dapat dilanjutkan sampai sistem diperbarui.') }}
							</p>

							<!-- Button -->
							<button
								@click="handleConfirm"
								class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
							>
								{{ __('Refresh Sekarang') }}
							</button>
						</div>

						<!-- Refreshing Animation -->
						<div
							v-else
							key="refreshing"
							class="bg-white rounded-2xl shadow-2xl p-12 max-w-md mx-4 transform"
						>
							<div class="flex flex-col items-center">
								<div class="relative mb-6">
									<div class="w-24 h-24 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
								</div>

								<h3 class="text-xl font-bold text-gray-900 mb-2">
									{{ __('Memperbarui Sistem...') }}
								</h3>
								<p class="text-gray-500 text-center">
									{{ __('Mohon tunggu, halaman akan dimuat ulang') }}
								</p>
							</div>
						</div>
					</Transition>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { ref } from "vue"

defineProps({
	show: {
		type: Boolean,
		default: false,
	},
})

const emit = defineEmits(["confirm"])

const isRefreshing = ref(false)

function handleConfirm() {
	isRefreshing.value = true
	emit("confirm")
}
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
	transition: opacity 0.3s ease;
}

.overlay-enter-from,
.overlay-leave-to {
	opacity: 0;
}

.card-enter-active,
.card-leave-active {
	transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-enter-from {
	opacity: 0;
	transform: scale(0.9) translateY(-20px);
}

.card-leave-to {
	opacity: 0;
	transform: scale(0.9) translateY(20px);
}
</style>

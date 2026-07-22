<template>
	<Dialog v-model="show" :options="{ title: __('Speed Mode Belum Siap'), size: 'sm' }">
		<template #body-content>
			<div class="flex flex-col gap-4">
				<p class="text-sm text-gray-600">
					{{ __("Beberapa data perlu disiapkan sebelum Speed Mode bisa diaktifkan.") }}
				</p>

				<ul class="flex flex-col gap-3">
					<li v-for="check in liveChecks" :key="check.key" class="flex items-start gap-3">
						<!-- Status icon -->
						<div class="flex-shrink-0 mt-0.5">
							<svg v-if="check.status === 'ok'" class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<svg v-else-if="check.status === 'syncing'" class="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
							</svg>
							<svg v-else class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
							</svg>
						</div>

						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between gap-2">
								<div
									class="text-sm font-medium"
									:class="check.status === 'ok' ? 'text-gray-400' : 'text-gray-800'"
								>
									{{ check.label }}
								</div>

								<!-- Download button — only for "missing" checks that have a fetcher -->
								<button
									v-if="check.status === 'missing' && canFetch(check.key)"
									:disabled="downloading[check.key]"
									class="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
									@click="fetchCheck(check.key)"
								>
									<svg
										class="w-3 h-3"
										:class="downloading[check.key] ? 'animate-spin' : ''"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path v-if="downloading[check.key]" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
										<path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
									</svg>
									{{ downloading[check.key] ? __("Mengambil...") : __("Download") }}
								</button>
							</div>

							<!-- Progress bar for syncing items -->
							<div v-if="check.status === 'syncing'" class="mt-1.5">
								<div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full bg-blue-500 rounded-full transition-all duration-500"
										:style="{ width: `${check.progress ?? 5}%` }"
									/>
								</div>
								<div class="text-xs text-blue-600 mt-0.5">
									{{ check.progress != null ? __("{0}% selesai", [check.progress]) : __("Sedang mendownload...") }}
								</div>
							</div>

							<div v-else-if="check.status === 'missing'" class="text-xs text-gray-400 mt-0.5">
								{{ fetchError[check.key] || __("Belum tersedia") }}
							</div>
						</div>
					</li>
				</ul>

				<!-- Info footer -->
				<div
					v-if="hasSyncing"
					class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5"
				>
					{{ __("Data sedang didownload di latar belakang. Tunggu hingga selesai, lalu klik Cek Ulang.") }}
				</div>
				<div
					v-else-if="hasMissing"
					class="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2.5"
				>
					{{ __("Klik tombol Download di samping item yang belum tersedia, lalu aktifkan Speed Mode lagi.") }}
				</div>
			</div>
		</template>

		<template #actions>
			<div class="flex gap-2">
				<Button variant="subtle" :loading="refreshing" @click="handleRefresh">
					{{ __("Cek Ulang") }}
				</Button>
				<Button variant="solid" theme="gray" @click="show = false">
					{{ __("Tutup") }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { useItemSearchStore } from "@/stores/itemSearch"
import { usePOSOffersStore } from "@/stores/posOffers"
import { usePOSShiftStore } from "@/stores/posShift"
import { getSpeedModeReadiness } from "@/composables/useSpeedModeReadiness"
import {
	cachePaymentMethodsFromServer,
	cacheCustomersIncremental,
} from "@/utils/offline"
import { offlineWorker } from "@/utils/offline/workerClient"
import { Button, Dialog } from "frappe-ui"
import { computed, reactive, ref, watch } from "vue"

const props = defineProps({
	modelValue: Boolean,
	initialChecks: {
		type: Array,
		default: () => [],
	},
})

const emit = defineEmits(["update:modelValue"])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

const shiftStore = usePOSShiftStore()
const itemStore = useItemSearchStore()
const offersStore = usePOSOffersStore()

const checks = ref([...props.initialChecks])

// Per-check download state
const downloading = reactive({})
const fetchError = reactive({})

watch(
	() => props.initialChecks,
	(val) => {
		checks.value = [...val]
	},
	{ deep: true },
)

// Keep "items" check live from itemStore reactive state
watch(
	[() => itemStore.cacheSyncing, () => itemStore.cacheStats?.syncProgress, () => itemStore.cacheReady],
	() => {
		const itemCheck = checks.value.find((c) => c.key === "items")
		if (!itemCheck) return
		const syncProgress = itemStore.cacheStats?.syncProgress
		if (itemStore.cacheSyncing || (syncProgress != null && syncProgress < 100)) {
			itemCheck.status = "syncing"
			itemCheck.progress = syncProgress
		} else if (itemStore.cacheReady && (itemStore.cacheStats?.items ?? 0) > 0) {
			itemCheck.status = "ok"
		}
	},
	{ immediate: true },
)

const hasSyncing = computed(() => checks.value.some((c) => c.status === "syncing"))
const hasMissing = computed(() => checks.value.some((c) => c.status === "missing"))

const liveChecks = computed(() =>
	[...checks.value].sort((a, b) => {
		const order = { syncing: 0, missing: 1, ok: 2 }
		return (order[a.status] ?? 3) - (order[b.status] ?? 3)
	}),
)

// Which checks have a Download button
function canFetch(key) {
	return ["payments", "offers", "customers"].includes(key)
}

// Per-check download handlers
async function fetchCheck(key) {
	if (downloading[key]) return
	downloading[key] = true
	delete fetchError[key]

	const profile = shiftStore.profileName

	try {
		if (key === "payments") {
			const result = await cachePaymentMethodsFromServer(profile)
			if (result?.payment_methods?.length) {
				const withProfile = result.payment_methods.map((m) => ({ ...m, pos_profile: profile }))
				await offlineWorker.cachePaymentMethods(withProfile)
			}
		} else if (key === "offers") {
			offersStore.hasFetched = false
			await offersStore.ensureOffersFetched(profile)
		} else if (key === "customers") {
			const { customers } = await cacheCustomersIncremental(profile)
			if (customers?.length) {
				await offlineWorker.cacheCustomers(customers)
			}
		}
		// Re-run readiness to update the check status
		const result = await getSpeedModeReadiness(profile)
		checks.value = result.checks
	} catch (err) {
		fetchError[key] = __("Gagal: {0}", [err?.message || String(err)])
	} finally {
		downloading[key] = false
	}
}

const refreshing = ref(false)

async function handleRefresh() {
	refreshing.value = true
	try {
		const result = await getSpeedModeReadiness(shiftStore.profileName)
		checks.value = result.checks
	} finally {
		refreshing.value = false
	}
}
</script>

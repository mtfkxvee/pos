import { useShift, shiftState } from "@/composables/useShift"
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/utils/currency"
import { defineStore } from "pinia"
import { computed, ref } from "vue"

export const usePOSShiftStore = defineStore("posShift", () => {
	// Use the existing shift composable
	const { currentProfile, currentShift, hasOpenShift, checkOpeningShift } =
		useShift()

	// Additional shift state
	const currentTime = ref("")
	const shiftDuration = ref("")
	const shiftTimerPaused = ref(false)

	// Computed
	const profileName = computed(() => currentProfile.value?.name)
	const profileCurrency = computed(
		() => currentProfile.value?.currency || DEFAULT_CURRENCY,
	)
	const profileWarehouse = computed(() => currentProfile.value?.warehouse)
	const profileCompany = computed(() => currentProfile.value?.company)
	const profileCustomer = computed(() => currentProfile.value?.customer)
	const autoPrintEnabled = computed(
		() => currentProfile.value?.print_receipt_on_order_complete,
	)
	const writeOffAccount = computed(
		() => currentProfile.value?.write_off_account,
	)
	const writeOffCostCenter = computed(
		() => currentProfile.value?.write_off_cost_center,
	)
	const writeOffLimit = computed(
		() => currentProfile.value?.write_off_limit || 0,
	)

	// Actions
	function updateShiftDuration() {
		if (!hasOpenShift.value || !currentShift.value?.period_start_date) {
			shiftDuration.value = ""
			return
		}

		// Freeze the counter when closing dialog is open
		if (shiftTimerPaused.value) return

		// Elapsed = initial elapsed (server_now - shift_start, computed at fetch time)
		//         + time since we received the data (local clock only)
		// This avoids timezone mismatch between server and browser.
		const { _initialElapsedMs, _receivedAt } = shiftState.value
		const diff = _initialElapsedMs + (Date.now() - (_receivedAt || Date.now()))
		if (diff < 0) {
			shiftDuration.value = ""
			return
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24))
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
		const seconds = Math.floor((diff % (1000 * 60)) / 1000)

		if (days > 0) {
			const dayLabel = days === 1 ? __("Day") : __("Days")
			const hourLabel = hours === 1 ? __("Hour") : __("Hours")
			const minLabel = minutes === 1 ? __("Minute") : __("Minutes")
			shiftDuration.value = `${days} ${dayLabel} ${hours} ${hourLabel} ${minutes} ${minLabel}`
		} else {
			const hourLabel = hours === 1 ? __("Hour") : __("Hours")
			const minLabel = minutes === 1 ? __("Minute") : __("Minutes")
			const secLabel = seconds === 1 ? __("Second") : __("Seconds")
			shiftDuration.value = `${hours} ${hourLabel} ${minutes} ${minLabel} ${seconds} ${secLabel}`
		}
	}

	function updateCurrentTime() {
		const now = new Date()
		currentTime.value = now.toLocaleTimeString(DEFAULT_LOCALE, {
			hour12: false,
		})
	}

	function startTimers() {
		// Update both immediately
		updateCurrentTime()
		updateShiftDuration()

		// Then update every second
		const intervalId = setInterval(() => {
			updateCurrentTime()
			updateShiftDuration()
		}, 1000)

		return intervalId
	}

	async function checkShift() {
		let serverReachable = true
		try {
			// When cached shift data exists, race the fetch against a 3-second timeout.
			// Without this, the SW's NetworkFirst 10-second timeout causes a blank loading
			// screen for 10 s every time the server is down but the user has prior data.
			const hasCachedData = !!localStorage.getItem("pos_shift_data")
			const fetchPromise = checkOpeningShift.fetch()
			if (hasCachedData) {
				await Promise.race([
					fetchPromise,
					new Promise((_, rej) =>
						setTimeout(() => rej(new Error("server_timeout")), 3000),
					),
				])
			} else {
				await fetchPromise
			}
		} catch {
			serverReachable = false
			// If the 3-second timeout fired, onError in useShift.js may not have run yet
			// (the actual fetch is still pending).  Load the cache manually so
			// hasOpenShift.value is correct before we check it below.
			if (!hasOpenShift.value) {
				const raw = localStorage.getItem("pos_shift_data")
				if (raw) {
					try {
						const data = JSON.parse(raw)
						shiftState.value = {
							pos_opening_shift: data.pos_opening_shift,
							pos_profile: data.pos_profile,
							company: data.company,
							isOpen: true,
							_initialElapsedMs: data._initialElapsedMs || 0,
							_receivedAt: data._receivedAt || Date.now(),
						}
					} catch {}
				}
			}
			if (!hasOpenShift.value) {
				throw new Error("Tidak ada data shift (offline dan tidak ada cache)")
			}
		}
		return { hasShift: hasOpenShift.value, serverReachable }
	}

	return {
		// State
		currentProfile,
		currentShift,
		hasOpenShift,
		currentTime,
		shiftDuration,
		shiftTimerPaused,

		// Computed
		profileName,
		profileCurrency,
		profileWarehouse,
		profileCompany,
		profileCustomer,
		autoPrintEnabled,
		writeOffAccount,
		writeOffCostCenter,
		writeOffLimit,

		// Actions
		updateShiftDuration,
		updateCurrentTime,
		startTimers,
		checkShift,
		checkOpeningShift,
	}
})

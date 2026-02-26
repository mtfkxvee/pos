/**
 * Quick Amounts Composable
 * Generates suggested payment amounts based on remaining balance
 *
 * Logic:
 * - Always show exact amount first
 * - Round 1: ceil to nearest small denomination (5k, 10k, 50k based on amount)
 * - Round 2: ceil to nearest larger denomination
 * - Skip duplicates (if round == exact, don't show)
 * - Maximum 3 buttons
 *
 * Examples:
 *   75,000  → [75000, 80000, 100000]     (exact, ceil 5k, ceil 50k)
 *   178,000 → [178000, 180000, 200000]   (exact, ceil 10k, ceil 50k)
 *   1,780,000 → [1780000, 1800000]       (exact, ceil 100k)
 */

import { computed } from "vue"
import { roundCurrency } from "@/utils/currency"

/**
 * Determine rounding tiers based on amount size
 * Returns [smallRound, bigRound] denominations
 */
function getRoundingTiers(amount) {
	if (amount <= 0) return [1000, 5000]
	if (amount < 10000) return [1000, 5000]          // < 10k: round 1k, 5k
	if (amount < 50000) return [5000, 10000]          // < 50k: round 5k, 10k
	if (amount < 100000) return [5000, 50000]         // < 100k: round 5k, 50k
	if (amount < 500000) return [10000, 50000]        // < 500k: round 10k, 50k
	if (amount < 1000000) return [50000, 100000]      // < 1M: round 50k, 100k
	if (amount < 5000000) return [100000, 500000]     // < 5M: round 100k, 500k
	return [500000, 1000000]                           // >= 5M: round 500k, 1M
}

/**
 * Create quick amounts suggestions based on remaining amount
 * @param {ComputedRef<number>} remainingAmount - Remaining amount to pay
 * @param {ComputedRef<boolean>} isCash - Whether the selected payment method is cash
 * @returns {Object} Computed quick amounts array
 */
export function useQuickAmounts(remainingAmount, isCash) {
	const quickAmounts = computed(() => {
		const remaining = remainingAmount.value
		if (remaining <= 0) {
			return [10000, 20000, 50000]
		}

		const cash = isCash ? isCash.value : true
		// Cash: ceil to whole number; Non-cash: exact fractional
		const exactAmount = cash ? Math.ceil(remaining) : roundCurrency(remaining)

		const amounts = []

		// 1. Always add exact amount
		amounts.push(exactAmount)

		// 2. Calculate rounded amounts
		const [smallDenom, bigDenom] = getRoundingTiers(remaining)

		const round1 = Math.ceil(remaining / smallDenom) * smallDenom
		const round2 = Math.ceil(remaining / bigDenom) * bigDenom

		// 3. Add round1 if different from exact
		if (round1 > exactAmount && !amounts.includes(round1)) {
			amounts.push(round1)
		}

		// 4. Add round2 if different from all existing
		if (round2 > exactAmount && !amounts.includes(round2)) {
			amounts.push(round2)
		}

		// Return sorted, max 3
		return amounts
			.filter((amt) => amt > 0)
			.sort((a, b) => a - b)
			.slice(0, 3)
	})

	return {
		quickAmounts,
	}
}

/**
 * Generate offline invoice ID: [POS3][KSR3][DD][MM][HH][MM][SEQ4]
 * Example: XPYREG130309430001
 *
 * - POS3: first 3 alphanumeric chars of POS profile name (uppercase)
 * - KSR3: first 3 alphanumeric chars of cashier username (uppercase)
 * - DD/MM: day and month of transaction
 * - HH/MM: hour and minute of transaction
 * - SEQ4: 4-digit daily counter per POS profile (resets each calendar day)
 */
export function generateOfflineInvoiceId(posProfile, owner, date = new Date()) {
	const clean = (s, n) =>
		(s || '').replace(/[^A-Za-z0-9]/g, '').substring(0, n).toUpperCase().padEnd(n, 'X')

	const pos3 = clean(posProfile, 3)
	const ksr3 = clean(owner, 3)
	const dd = String(date.getDate()).padStart(2, '0')
	const mm = String(date.getMonth() + 1).padStart(2, '0')
	const hh = String(date.getHours()).padStart(2, '0')
	const mn = String(date.getMinutes()).padStart(2, '0')

	// Daily counter per POS profile — persists across page refreshes, resets each calendar day
	const dayKey = `${dd}${mm}${date.getFullYear()}`
	const storageKey = `pos_offline_seq_${pos3}_${dayKey}`
	const next = parseInt(localStorage.getItem(storageKey) || '0', 10) + 1
	localStorage.setItem(storageKey, String(next))
	const seq = String(next).padStart(4, '0')

	return `${pos3}${ksr3}${dd}${mm}${hh}${mn}${seq}`
}

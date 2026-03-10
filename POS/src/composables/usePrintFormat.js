import { ref } from "vue"

const STORAGE_KEY = "pos_print_format"
const VALID_FORMATS = ["58 PRINTER", "80 PRINTER"]

// Shared singleton state across all composable instances
const printFormat = ref(loadSavedFormat())
const showFormatDialog = ref(false)

function loadSavedFormat() {
	const saved = localStorage.getItem(STORAGE_KEY)
	if (saved && VALID_FORMATS.includes(saved)) {
		return saved
	}
	return null // null = not yet chosen
}

export function usePrintFormat() {
	/**
	 * Set the active print format and persist to localStorage
	 * @param {"58 PRINTER"|"80 PRINTER"} format
	 */
	function setPrintFormat(format) {
		if (!VALID_FORMATS.includes(format)) return
		printFormat.value = format
		localStorage.setItem(STORAGE_KEY, format)
		showFormatDialog.value = false
	}

	/**
	 * Show the format selector dialog (e.g. when going offline and no
	 * format has been selected yet)
	 */
	function promptForFormat() {
		if (!printFormat.value) {
			showFormatDialog.value = true
		}
	}

	/**
	 * Returns the effective format, defaulting to "80 PRINTER" if none set
	 */
	function getEffectiveFormat() {
		return printFormat.value || "80 PRINTER"
	}

	return {
		printFormat,
		showFormatDialog,
		setPrintFormat,
		promptForFormat,
		getEffectiveFormat,
	}
}

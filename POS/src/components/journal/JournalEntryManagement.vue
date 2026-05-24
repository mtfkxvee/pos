<template>
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[300]"
			@click.self="handleClose"
		>
			<div class="fixed inset-0 flex items-center justify-center p-4">
				<div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">

					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-4 border-b">
						<div class="flex items-center gap-3">
							<BookOpenIcon class="w-5 h-5 text-amber-600" />
							<div>
								<h2 class="text-lg font-semibold text-gray-900">{{ __('Journal Entry') }}</h2>
								<p class="text-sm text-gray-500">{{ __('Record operational expenses') }}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								v-if="view === 'form'"
								@click="view = 'list'"
								class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
							>
								<ArrowLeftIcon class="w-4 h-4" />
								{{ __('Back') }}
							</button>
							<button
								v-if="view === 'list'"
								@click="openForm"
								class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
							>
								<PlusIcon class="w-4 h-4" />
								{{ __('New Entry') }}
							</button>
							<button
								@click="handleClose"
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
							>
								<XMarkIcon class="w-5 h-5" />
							</button>
						</div>
					</div>

					<!-- LIST VIEW -->
					<div v-if="view === 'list'" class="flex-1 overflow-auto">
						<div v-if="loading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
							{{ __('Loading...') }}
						</div>

						<div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
							<BookOpenIcon class="w-10 h-10 opacity-30" />
							<span class="text-sm">{{ __('No journal entries found') }}</span>
						</div>

						<table v-else class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
								<tr>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Date') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('ID') }}</th>
									<th class="px-5 py-3 text-start text-xs font-medium text-gray-500 uppercase">{{ __('Description') }}</th>
									<th class="px-5 py-3 text-end text-xs font-medium text-gray-500 uppercase">{{ __('Amount') }}</th>
									<th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">{{ __('Status') }}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								<tr v-for="entry in entries" :key="entry.name" class="hover:bg-gray-50">
									<td class="px-5 py-3 text-gray-700 whitespace-nowrap">{{ formatDate(entry.posting_date) }}</td>
									<td class="px-5 py-3 text-gray-400 font-mono text-xs">{{ entry.name }}</td>
									<td class="px-5 py-3 text-gray-600 max-w-xs truncate">{{ entry.user_remark || '-' }}</td>
									<td class="px-5 py-3 text-end font-medium text-gray-800">{{ formatCurrency(entry.total_debit) }}</td>
									<td class="px-5 py-3 text-center">
										<span :class="[
											'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
											entry.docstatus === 1 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
										]">
											{{ entry.docstatus === 1 ? __('Submitted') : __('Draft') }}
										</span>
									</td>
								</tr>
							</tbody>
						</table>

						<div v-if="hasMore" class="flex justify-center py-4">
							<button @click="loadMore" class="text-sm text-amber-600 hover:text-amber-700 font-medium">
								{{ __('Load more') }}
							</button>
						</div>
					</div>

					<!-- FORM VIEW -->
					<div v-else class="flex-1 overflow-auto">
						<div class="max-w-2xl mx-auto px-6 py-5">
							<!-- Date + Credit Account -->
							<div class="grid grid-cols-2 gap-4 mb-4">
								<div>
									<label class="block text-xs font-medium text-gray-600 mb-1">{{ __('Date') }}</label>
									<input
										v-model="form.posting_date"
										type="date"
										class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
									/>
								</div>
								<div>
									<label class="block text-xs font-medium text-gray-600 mb-1">
										{{ __('Credit Account') }} <span class="text-red-500">*</span>
									</label>
									<select
										v-model="form.credit_account"
										class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
									>
										<option value="">{{ __('Select account...') }}</option>
										<option v-for="acc in paymentAccounts" :key="acc.name" :value="acc.name">
											{{ acc.name }}
										</option>
									</select>
								</div>
							</div>

							<!-- Description -->
							<div class="mb-5">
								<label class="block text-xs font-medium text-gray-600 mb-1">{{ __('Description') }}</label>
								<input
									v-model="form.user_remark"
									type="text"
									:placeholder="__('e.g. Office supplies, utilities...')"
									class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
								/>
							</div>

							<!-- Expense rows -->
							<div class="mb-3">
								<div class="flex items-center justify-between mb-2">
									<label class="text-xs font-medium text-gray-600 uppercase tracking-wide">{{ __('Expense Details') }}</label>
									<button @click="addRow" class="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
										<PlusIcon class="w-3 h-3" />
										{{ __('Add row') }}
									</button>
								</div>

								<div class="border border-gray-200 rounded-lg overflow-hidden">
									<div class="grid grid-cols-[1fr_1fr_130px_36px] bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
										<span>{{ __('Expense Account') }}</span>
										<span>{{ __('Description') }}</span>
										<span class="text-end">{{ __('Amount') }}</span>
										<span />
									</div>
									<div
										v-for="(row, idx) in form.expense_rows"
										:key="idx"
										class="grid grid-cols-[1fr_1fr_130px_36px] border-b border-gray-100 last:border-0 items-center"
									>
										<div class="px-2 py-2 border-e border-gray-100">
											<select v-model="row.account" class="w-full text-sm bg-transparent focus:outline-none">
												<option value="">{{ __('Select...') }}</option>
												<option v-for="acc in expenseAccounts" :key="acc.name" :value="acc.name">
													{{ acc.name }}
												</option>
											</select>
										</div>
										<div class="px-2 py-2 border-e border-gray-100">
											<input v-model="row.description" type="text" :placeholder="__('Note')" class="w-full text-sm bg-transparent focus:outline-none" />
										</div>
										<div class="px-2 py-2 border-e border-gray-100">
											<input v-model.number="row.amount" type="number" min="0" step="any" class="w-full text-sm bg-transparent focus:outline-none text-end" placeholder="0" />
										</div>
										<div class="flex items-center justify-center">
											<button v-if="form.expense_rows.length > 1" @click="removeRow(idx)" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500">
												<XMarkIcon class="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
							</div>

							<!-- Total -->
							<div class="flex justify-end mb-6 text-sm text-gray-600">
								{{ __('Total') }}:
								<span class="font-semibold text-gray-900 ms-2">{{ formatCurrency(formTotal) }}</span>
							</div>

							<!-- Actions -->
							<div class="flex gap-3 justify-end">
								<button
									@click="saveEntry(false)"
									:disabled="submitting"
									class="px-4 py-2 text-sm border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
								>
									{{ __('Save Draft') }}
								</button>
								<button
									@click="saveEntry(true)"
									:disabled="submitting"
									class="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
								>
									<span v-if="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
									{{ submitting ? __('Submitting...') : __('Submit') }}
								</button>
							</div>
						</div>
					</div>

				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { ref, computed, watch } from "vue"
import { ArrowLeftIcon, PlusIcon, XMarkIcon, BookOpenIcon } from "@heroicons/vue/24/outline"
import { call } from "@/utils/apiWrapper"
import { useToast } from "@/composables/useToast"

const props = defineProps({
	modelValue: Boolean,
	posProfile: { type: String, default: "" },
	currency: { type: String, default: "IDR" },
})
const emit = defineEmits(["update:modelValue"])
const { showSuccess, showError, showWarning } = useToast()

// ── State ────────────────────────────────────────────────────────────────────
const show = ref(props.modelValue)
const view = ref("list")
const loading = ref(false)
const submitting = ref(false)
const entries = ref([])
const expenseAccounts = ref([])
const paymentAccounts = ref([])
const page = ref(1)
const PAGE_SIZE = 20
const hasMore = ref(false)
const form = ref(defaultForm())

// ── Sync v-model ─────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => { show.value = val })
watch(show, (val) => { emit("update:modelValue", val) })

// ── Computed ─────────────────────────────────────────────────────────────────
const formTotal = computed(() =>
	form.value.expense_rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function defaultForm() {
	return {
		posting_date: new Date().toISOString().slice(0, 10),
		user_remark: "",
		credit_account: "",
		expense_rows: [{ account: "", description: "", amount: null }],
	}
}

function formatDate(d) {
	if (!d) return ""
	return new Date(d).toLocaleDateString("id-ID")
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: props.currency || "IDR",
		minimumFractionDigits: 0,
	}).format(amount || 0)
}

// ── Actions ──────────────────────────────────────────────────────────────────
function addRow() {
	form.value.expense_rows.push({ account: "", description: "", amount: null })
}

function removeRow(idx) {
	form.value.expense_rows.splice(idx, 1)
}

function openForm() {
	form.value = defaultForm()
	view.value = "form"
}

function handleClose() {
	show.value = false
}

async function loadAccounts() {
	if (!props.posProfile) return
	try {
		const [exp, pay] = await Promise.all([
			call("pos_next.api.journal_entry.get_expense_accounts", { pos_profile: props.posProfile }),
			call("pos_next.api.journal_entry.get_payment_accounts", { pos_profile: props.posProfile }),
		])
		expenseAccounts.value = exp || []
		paymentAccounts.value = pay || []
	} catch (e) {
		console.error("Journal: failed to load accounts", e)
	}
}

async function loadEntries(reset = false) {
	if (!props.posProfile) return
	if (reset) { page.value = 1; entries.value = [] }
	loading.value = true
	try {
		const rows = await call("pos_next.api.journal_entry.get_journal_entries", {
			pos_profile: props.posProfile,
			page_size: PAGE_SIZE,
			page: page.value,
		}) || []
		entries.value = reset ? rows : [...entries.value, ...rows]
		hasMore.value = rows.length === PAGE_SIZE
	} finally {
		loading.value = false
	}
}

async function loadMore() {
	page.value++
	await loadEntries(false)
}

async function saveEntry(submit) {
	if (!form.value.credit_account) {
		showWarning(__("Please select a credit account."))
		return
	}
	const validRows = form.value.expense_rows.filter(r => r.account && r.amount > 0)
	if (!validRows.length) {
		showWarning(__("Please add at least one expense row with account and amount."))
		return
	}

	submitting.value = true
	try {
		await call("pos_next.api.journal_entry.create_journal_entry", {
			pos_profile: props.posProfile,
			posting_date: form.value.posting_date,
			user_remark: form.value.user_remark,
			expense_rows: validRows,
			credit_account: form.value.credit_account,
			submit,
		})
		showSuccess(submit ? __("Journal Entry submitted.") : __("Journal Entry saved as draft."))
		view.value = "list"
		await loadEntries(true)
	} catch (e) {
		showError(e.message || __("Failed to save journal entry."))
	} finally {
		submitting.value = false
	}
}

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(
	() => props.modelValue,
	async (val) => {
		if (val) {
			view.value = "list"
			await Promise.all([loadAccounts(), loadEntries(true)])
		}
	},
)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>

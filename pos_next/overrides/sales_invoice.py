# Copyright (c) 2025, BrainWise and contributors
# For license information, please see license.txt

"""
Sales Invoice Override
Handles wallet payments that require party information for Receivable accounts.

"""

import frappe
from frappe.utils import cint, flt
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from erpnext.accounts.utils import get_account_currency

def _get_post_change_gl_entries_setting():
	"""
	Get post_change_gl_entries setting compatible with ERPNext v15 and v16.

	- ERPNext v15: Field is in 'Accounts Settings'
	- ERPNext v16: Field moved to ERPNext's 'POS Settings' (singleton)

	Since pos_next has its own 'POS Settings' doctype (non-singleton) that overrides
	ERPNext's, we read directly from the Singles table for v16 compatibility.

	Returns:
		int: 1 if post_change_gl_entries is enabled, 0 otherwise (default: 0)
	"""
	# Check if field exists in Accounts Settings schema (v15)
	meta = frappe.get_meta("Accounts Settings")
	if meta.has_field("post_change_gl_entries"):
		value = frappe.db.get_single_value("Accounts Settings", "post_change_gl_entries")
		return cint(value) if value is not None else 0

	# For v16, read directly from Singles table using Query Builder to avoid ORM issues
	# ERPNext's POS Settings is a singleton, data stored in Singles table
	Singles = frappe.qb.DocType("Singles")
	result = (
		frappe.qb.from_(Singles)
		.select(Singles.value)
		.where(Singles.doctype == "POS Settings")
		.where(Singles.field == "post_change_gl_entries")
		.limit(1)
		.run()
	)
	return cint(result[0][0]) if result else 0

class CustomSalesInvoice(SalesInvoice):
	"""
	Custom Sales Invoice class that handles wallet payments correctly.

	When a wallet payment is made using a Receivable account, ERPNext requires
	party information in the GL entry. This override adds party_type and party
	for wallet payment methods marked with is_wallet_payment.
	"""

	def make_pos_gl_entries(self, gl_entries):
		"""
		Override to add party information for wallet payment accounts.

		The standard ERPNext implementation doesn't set party_type/party for
		payment mode accounts, which causes validation errors for Receivable
		accounts (like wallet accounts).
		"""
		if cint(self.is_pos):
			skip_change_gl_entries = not _get_post_change_gl_entries_setting()

			for payment_mode in self.payments:
				if skip_change_gl_entries and payment_mode.account == self.account_for_change_amount:
					payment_mode.base_amount -= flt(self.change_amount)

				if payment_mode.amount:
					# POS, make payment entries
					# Credit entry to debit_to (customer receivable)
					gl_entries.append(
						self.get_gl_dict(
							{
								"account": self.debit_to,
								"party_type": "Customer",
								"party": self.customer,
								"against": payment_mode.account,
								"credit": payment_mode.base_amount,
								"credit_in_account_currency": payment_mode.base_amount
								if self.party_account_currency == self.company_currency
								else payment_mode.amount,
								"against_voucher": self.return_against
								if cint(self.is_return) and self.return_against
								else self.name,
								"against_voucher_type": self.doctype,
								"cost_center": self.cost_center,
							},
							self.party_account_currency,
							item=self,
						)
					)

					# Debit entry to payment mode account
					payment_mode_account_currency = get_account_currency(payment_mode.account)

					# Get party info for wallet payments
					party_type, party = self.get_party_and_party_type_for_pos_gl_entry(
						payment_mode.mode_of_payment, payment_mode.account
					)

					gl_entries.append(
						self.get_gl_dict(
							{
								"account": payment_mode.account,
								"party_type": party_type,
								"party": party,
								"against": self.customer,
								"debit": payment_mode.base_amount,
								"debit_in_account_currency": payment_mode.base_amount
								if payment_mode_account_currency == self.company_currency
								else payment_mode.amount,
								"cost_center": self.cost_center,
							},
							payment_mode_account_currency,
							item=self,
						)
					)

			if not skip_change_gl_entries:
				if hasattr(self, "get_gle_for_change_amount"):
					# ERPNext v16+: Method renamed and returns a list of GL entries
					# that needs to be extended to the main gl_entries list
					gl_entries.extend(self.get_gle_for_change_amount())
				else:
					# ERPNext v15: Method takes gl_entries as parameter
					# and appends change amount entries directly to it
					self.make_gle_for_change_amount(gl_entries)

	def validate(self):
		"""
		Override validate to:
		1. Restore payments after ERPNext's validate() may clear them.
		2. Restore discount_amount after ERPNext's set_pos_fields() may reset it to 0.

		ERPNext's set_pos_fields() (called inside super().validate()) reloads all
		payment methods from POS Profile with amount=0, and may also reset
		discount_amount to 0. We snapshot both before and restore after.
		"""
		# Snapshot discount BEFORE super().validate() potentially resets it.
		saved_discount_amount = flt(self.discount_amount or 0)
		saved_apply_discount_on = self.apply_discount_on or "Grand Total"

		# Always snapshot DB payment count BEFORE super().validate() touches self.payments.
		db_payment_count = 0
		if self.name and not self.is_new():
			try:
				db_payment_count = frappe.db.count(
					"Sales Invoice Payment", {"parent": self.name}
				)
			except Exception:
				pass

		super().validate()

		# After super().validate(): if DB had payments but memory is now empty, restore
		if db_payment_count and not self.get("payments"):
			try:
				db_payments = frappe.get_all(
					"Sales Invoice Payment",
					filters={"parent": self.name},
					fields=["mode_of_payment", "amount", "base_amount", "type", "account"],
					order_by="idx asc",
				)
				if db_payments:
					self.set("payments", db_payments)
					total_paid = sum(flt(p.get("amount", 0)) for p in db_payments)
					self.paid_amount = total_paid
					self.outstanding_amount = max(0, flt(self.grand_total) - total_paid)
			except Exception as e:
				frappe.log_error(
					f"POS Next: failed to restore payments in validate for {self.name}: {e}",
					"POS Payment Restore"
				)

		# Restore discount_amount if super().validate() cleared it.
		# set_pos_fields() resets discount_amount to 0; re-apply and recalculate.
		if saved_discount_amount > 0 and not flt(self.discount_amount):
			self.discount_amount = saved_discount_amount
			self.apply_discount_on = saved_apply_discount_on
			try:
				self.calculate_taxes_and_totals()
				# Recalculate outstanding with restored grand_total
				total_paid = sum(flt(p.get("amount", 0) if isinstance(p, dict) else getattr(p, "amount", 0)) for p in (self.get("payments") or []))
				if total_paid > 0:
					self.paid_amount = total_paid
					self.outstanding_amount = max(0, flt(self.grand_total) - total_paid)
			except Exception as e:
				frappe.log_error(
					f"POS Next: failed to recalculate after discount restore for {self.name}: {e}",
					"POS Discount Restore"
				)

	def before_submit(self):
		"""
		Override debit_to with custom_receiveable from POS Profile (Pay-on-Account only).
		"""
		try:
			super().before_submit()
		except AttributeError:
			pass

		if not cint(self.is_pos) or not self.pos_profile:
			return

		if flt(self.outstanding_amount) <= 0:
			return

		try:
			custom_receiveable = frappe.db.get_value(
				"POS Profile", self.pos_profile, "custom_receiveable"
			)
			if custom_receiveable:
				self.debit_to = custom_receiveable
		except Exception as e:
			frappe.log_error(
				f"POS Next: failed to set custom_receiveable on {self.name}: {e}",
				"POS Custom Receivable"
			)

	def get_party_and_party_type_for_pos_gl_entry(self, mode_of_payment, account):
		"""
		Get party type and party for wallet payment GL entries.

		For wallet payments (Mode of Payment with is_wallet_payment=1),
		returns Customer as party_type and the invoice customer as party.
		For regular payments, returns empty strings.
		"""
		is_wallet_mode_of_payment = frappe.db.get_value(
			"Mode of Payment", mode_of_payment, "is_wallet_payment"
		)

		party_type, party = "", ""
		if is_wallet_mode_of_payment:
			party_type, party = "Customer", self.customer

		return party_type, party

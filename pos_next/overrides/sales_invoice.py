# Copyright (c) 2025, BrainWise and contributors
# For license information, please see license.txt

"""
Sales Invoice Override
Handles wallet payments and additional discount preservation.
"""

import frappe
from frappe.utils import cint, flt
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from erpnext.accounts.utils import get_account_currency

def _get_post_change_gl_entries_setting():
	"""
	Get post_change_gl_entries setting compatible with ERPNext v15 and v16.
	"""
	meta = frappe.get_meta("Accounts Settings")
	if meta.has_field("post_change_gl_entries"):
		value = frappe.db.get_single_value("Accounts Settings", "post_change_gl_entries")
		return cint(value) if value is not None else 0

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

	def set_pos_fields(self, for_validate=False):
		"""
		Override to preserve the fixed discount_amount set by submit_invoice.

		ERPNext's set_pos_fields() may restore additional_discount_percentage from
		POS Profile (e.g. 1% from DISKON MEMBER pricing rule), causing calculate_
		taxes_and_totals() to override our fixed discount_amount with 1% × net_total.

		If flags.pos_next_discount_amount is set, we zero the percentage and restore
		the fixed amount after every set_pos_fields() call.
		"""
		super().set_pos_fields(for_validate=for_validate)

		intended = self.flags.get("pos_next_discount_amount")
		if intended is not None:
			self.additional_discount_percentage = 0
			self.discount_amount = flt(intended)

	def validate(self):
		"""
		Override validate to:
		1. Restore payments if ERPNext's validate() cleared them.
		2. Preserve the fixed discount_amount after super().validate() recalculates it
		   from additional_discount_percentage (pricing rule 1%). Directly corrects
		   grand_total without calling calculate_taxes_and_totals() again (avoids loop).
		"""
		intended_da = self.flags.get("pos_next_discount_amount")

		# Snapshot DB payment count before super() touches payments
		db_payment_count = 0
		if self.name and not self.is_new():
			try:
				db_payment_count = frappe.db.count(
					"Sales Invoice Payment", {"parent": self.name}
				)
			except Exception:
				pass

		super().validate()

		# Restore payments if cleared by super().validate()
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
					f"POS Next: failed to restore payments for {self.name}: {e}",
					"POS Payment Restore"
				)

		# Restore fixed discount if pricing rule recalculated it from percentage
		if intended_da is not None and (
			flt(self.discount_amount) != flt(intended_da)
			or flt(self.additional_discount_percentage) != 0
		):
			self.discount_amount = flt(intended_da)
			self.additional_discount_percentage = 0
			# Directly fix grand_total — do NOT call calculate_taxes_and_totals()
			# which would trigger set_pos_fields() again and loop back here.
			self.grand_total = flt(self.net_total) - flt(intended_da)
			self.base_grand_total = self.grand_total
			# Recalculate outstanding from corrected grand_total
			total_paid = sum(
				flt(getattr(p, "amount", 0) if hasattr(p, "amount") else p.get("amount", 0))
				for p in (self.get("payments") or [])
			)
			self.outstanding_amount = max(0, flt(self.grand_total) - total_paid)

	def make_pos_gl_entries(self, gl_entries):
		"""
		Override to add party information for wallet payment accounts.
		"""
		if cint(self.is_pos):
			skip_change_gl_entries = not _get_post_change_gl_entries_setting()

			for payment_mode in self.payments:
				if skip_change_gl_entries and payment_mode.account == self.account_for_change_amount:
					payment_mode.base_amount -= flt(self.change_amount)

				if payment_mode.amount:
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

					payment_mode_account_currency = get_account_currency(payment_mode.account)
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
					gl_entries.extend(self.get_gle_for_change_amount())
				else:
					self.make_gle_for_change_amount(gl_entries)

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
		"""
		is_wallet_mode_of_payment = frappe.db.get_value(
			"Mode of Payment", mode_of_payment, "is_wallet_payment"
		)

		party_type, party = "", ""
		if is_wallet_mode_of_payment:
			party_type, party = "Customer", self.customer

		return party_type, party

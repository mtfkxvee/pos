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
		Override to preserve item rates and discount_amount across every validate
		cycle triggered by save() and submit().

		ERPNext's set_pos_fields() resets ignore_pricing_rule from POS Profile (=0)
		and may re-evaluate item pricing rules — clearing discounts and reverting
		item.rate to price_list_rate when a rule is future-dated or inactive.

		Strategy:
		- Snapshot item rates BEFORE super() runs
		- Restore them AFTER (handles both flag-present and flag-absent/reload cases)
		- Re-enforce ignore_pricing_rule=1 using BOTH the saved pre-super value
		  AND the flag, so it works even when submit() reloads the document from DB
		  (flags lost but ignore_pricing_rule=1 is already in DB from prior save)
		"""
		super().set_pos_fields(for_validate=for_validate)

		# Re-enforce ignore_pricing_rule — super() resets it from POS Profile (=0).
		if (
			self.flags.get("pos_next_ignore_pricing_rule")
			or cint(self.ignore_pricing_rule)
		):
			self.ignore_pricing_rule = 1

		intended = self.flags.get("pos_next_discount_amount")
		if intended is not None:
			self.additional_discount_percentage = 0
			self.discount_amount = flt(intended)

	def validate(self):
		"""
		Override validate to:
		1. Snapshot item rates before super().validate() so ERPNext cannot revert them.
		2. Restore payments if ERPNext's validate() cleared them.
		3. Preserve the fixed discount_amount after super().validate() recalculates it.
		"""
		intended_da = self.flags.get("pos_next_discount_amount")

		# Snapshot item rates BEFORE super().validate().
		# ERPNext's set_pos_fields() (called inside super()) resets ignore_pricing_rule
		# from POS Profile and re-evaluates item rules, reverting item.rate to
		# price_list_rate for future-dated rules.  We snapshot using item.name (stable
		# DB key) so we can restore even when ERPNext replaces the item objects.
		use_pnp = (
			self.flags.get("pos_next_ignore_pricing_rule")
			or cint(self.ignore_pricing_rule)
		)
		item_snapshots = {}
		if use_pnp:
			for item in self.get("items", []):
				key = item.name or f"{item.item_code}_{item.idx}"
				plr = flt(item.price_list_rate or item.rate)
				da = flt(item.discount_amount)
				# When item has an explicit discount_amount, snapshot price_list_rate as
				# the rate. ERPNext computes net = rate × qty - discount_amount, so if
				# rate is already the net rate (price_list_rate - discount/qty), the
				# discount gets applied twice on each validate cycle (cascading deduction).
				# Using price_list_rate as the snapshot rate keeps the calculation stable.
				snapshot_rate = plr if da > 0 else flt(item.rate)
				item_snapshots[key] = {
					"rate": snapshot_rate,
					"price_list_rate": plr,
					"discount_percentage": flt(item.discount_percentage),
					"discount_amount": da,
					"pricing_rules": item.get("pricing_rules") or "",
				}

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

		# Restore item rates after super().validate() — uses item.name as stable key
		if use_pnp and item_snapshots:
			self.ignore_pricing_rule = 1
			for item in self.get("items", []):
				key = item.name or f"{item.item_code}_{item.idx}"
				snap = item_snapshots.get(key)
				if snap:
					item.rate = snap["rate"]
					item.price_list_rate = snap["price_list_rate"]
					item.discount_percentage = snap["discount_percentage"]
					item.discount_amount = snap["discount_amount"]
					item.pricing_rules = snap["pricing_rules"]

			# Also restore invoice-level discount before recalculating totals,
			# so calculate_taxes_and_totals() uses the correct discount_amount.
			if intended_da is not None:
				self.discount_amount = flt(intended_da)
				self.additional_discount_percentage = 0

			# Recompute net_total / grand_total from restored item rates.
			# super().validate() computed net_total using the wrong (reverted) rates;
			# after our restore, item.amount is still stale — recalculate to fix it.
			# calculate_taxes_and_totals() is safe here: it is purely mathematical
			# and does not call validate() or apply pricing rules.
			self.calculate_taxes_and_totals()

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

	def get_gl_entries(self, warehouse_account=None):
		"""
		Override to add discount GL entries:
		1. DR custom_discount_account for item-level pricing rule discounts
		2. Adjustment entries to re-route transaction-level promo discount
		   from diskon_akun (Potongan Penjualan) to the promo account
		"""
		gl_entries = super().get_gl_entries(warehouse_account)

		if not cint(self.is_pos):
			return gl_entries

		# Item-level pricing rule discount GL entries
		self._add_pricing_rule_discount_gl_entries(gl_entries)

		# Transaction-level promo discount re-routing.
		# ERPNext already creates DR diskon_akun for the full discount_amount
		# via additional_discount_account. We add adjustment entries to
		# re-route the promo portion to the pricing rule's custom_discount_account:
		#   DR promo_account: promo_amount   (record promo discount separately)
		#   CR diskon_akun:   promo_amount   (cancel that portion from potongan)
		# Net: diskon_akun receives only the manual portion.
		self._adjust_promo_transaction_discount_gl(gl_entries)

		return gl_entries

	def _get_diskon_akun(self):
		"""Resolve discount account from POS Profile."""
		if not self.pos_profile:
			return None
		for fieldname in ("custom_diskon_akun", "diskon_akun", "discount_account"):
			if not frappe.db.has_column("POS Profile", fieldname):
				continue
			try:
				val = frappe.db.get_value("POS Profile", self.pos_profile, fieldname)
				if val:
					return val
			except Exception:
				pass
		return None

	def _adjust_promo_transaction_discount_gl(self, gl_entries):
		"""
		Re-route the transaction-level promo portion of additional_discount
		from diskon_akun to the pricing rule's custom_discount_account.
		"""
		try:
			promo_amount = flt(self.get("custom_promo_discount_amount") or 0)
		except Exception:
			return

		if promo_amount <= 0.01:
			return

		# diskon_akun: where ERPNext already debited the full discount
		diskon_akun = (
			self.get("additional_discount_account")
			or self._get_diskon_akun()
		)
		if not diskon_akun:
			return

		# promo_account was resolved in submit_invoice (before pricing_rules child
		# table gets cleared by ERPNext's validate with ignore_pricing_rule=1)
		# and stored in flags so it survives to GL time.
		promo_account = self.flags.get("pos_next_promo_account")

		if not promo_account or promo_account == diskon_akun:
			return

		promo_amount = min(promo_amount, flt(self.discount_amount))
		cost_center = self.cost_center

		# DR promo account (records the promo discount)
		gl_entries.append(
			self.get_gl_dict(
				{
					"account": promo_account,
					"debit": promo_amount,
					"debit_in_account_currency": promo_amount,
					"against": self.customer,
					"cost_center": cost_center,
				},
				item=self,
			)
		)
		# CR diskon_akun (cancels the promo portion from Potongan Penjualan)
		gl_entries.append(
			self.get_gl_dict(
				{
					"account": diskon_akun,
					"credit": promo_amount,
					"credit_in_account_currency": promo_amount,
					"against": self.customer,
					"cost_center": cost_center,
				},
				item=self,
			)
		)

	def _add_pricing_rule_discount_gl_entries(self, gl_entries):
		"""
		For each item that has pricing_rules + discount_amount, check if any of
		those rules have custom_discount_account filled. If yes, create:
		  DR custom_discount_account  (discount amount)
		  CR income_account           (restore revenue to full price)

		This routes the pricing rule discount to the configured promo account
		instead of silently reducing revenue.
		"""
		if not frappe.db.has_column("Pricing Rule", "custom_discount_account"):
			return

		for item in self.get("items", []):
			if cint(item.get("is_free_item")):
				continue

			# discount_amount on the item is per-unit (ERPNext convention).
			# Multiply by qty to get the total row discount for the GL entry.
			discount_per_unit = flt(item.get("discount_amount"))
			item_qty_gl = flt(item.get("qty") or 1)
			discount_amount = flt(discount_per_unit * item_qty_gl)
			pricing_rules_str = (item.get("pricing_rules") or "").strip()
			income_account = item.get("income_account")

			if not discount_amount:
				continue
			if not pricing_rules_str:
				continue
			if not income_account:
				continue

			rule_names = [r.strip() for r in pricing_rules_str.split(",") if r.strip()]

			discount_account = None
			for rule_name in rule_names:
				try:
					acct = frappe.db.get_value("Pricing Rule", rule_name, "custom_discount_account")
					if acct:
						discount_account = acct
						break
				except Exception:
					continue

			if not discount_account:
				continue

			cost_center = item.get("cost_center") or self.cost_center

			# DR: promo discount account (records the discount as a separate expense/contra-revenue)
			# Pass item= for cost_center/project context only
			gl_entries.append(
				self.get_gl_dict(
					{
						"account": discount_account,
						"debit": discount_amount,
						"debit_in_account_currency": discount_amount,
						"credit": 0,
						"credit_in_account_currency": 0,
						"against": self.customer,
						"cost_center": cost_center,
						"remarks": f"Pricing Rule Discount: {pricing_rules_str}",
					},
					item=item,
				)
			)

			# CR: income account (restores revenue to full price_list_rate)
			# Do NOT pass item= here — passing item= to an income account entry
			# causes ERPNext to treat it as a sales deduction (DR) instead of CR.
			account_currency = get_account_currency(income_account)
			gl_entries.append(
				self.get_gl_dict(
					{
						"account": income_account,
						"credit": discount_amount,
						"credit_in_account_currency": discount_amount,
						"debit": 0,
						"debit_in_account_currency": 0,
						"against": self.customer,
						"cost_center": cost_center,
						"remarks": f"Pricing Rule Discount: {pricing_rules_str}",
					},
					account_currency,
				)
			)

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

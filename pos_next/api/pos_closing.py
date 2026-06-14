# -*- coding: utf-8 -*-
import json
import frappe
from frappe.utils import flt


@frappe.whitelist()
def get_pos_closing_shifts(pos_profile, page_size=20, page=1):
	"""Return POS Closing Shift entries for a POS Profile, newest first."""
	if not pos_profile:
		return []

	offset = (int(page) - 1) * int(page_size)

	return frappe.db.sql(
		"""
		SELECT
			cs.name, cs.pos_profile, cs.user, u.full_name as cashier_name,
			cs.period_start_date, cs.period_end_date, cs.posting_date,
			cs.grand_total, cs.net_total, cs.total_quantity, cs.docstatus
		FROM `tabPOS Closing Shift` cs
		LEFT JOIN `tabUser` u ON u.name = cs.user
		WHERE cs.pos_profile = %(pos_profile)s
		ORDER BY cs.period_end_date DESC, cs.creation DESC
		LIMIT %(page_size)s OFFSET %(offset)s
		""",
		{"pos_profile": pos_profile, "page_size": int(page_size), "offset": offset},
		as_dict=True,
	)


@frappe.whitelist()
def get_pos_closing_shift_print_data(name):
	"""Return a submitted POS Closing Shift in the same shape `printShiftClosing` expects, for reprinting."""
	doc = frappe.get_doc("POS Closing Shift", name)

	invoice_names = [d.sales_invoice for d in doc.pos_transactions if d.sales_invoice]

	sales_total = 0
	returns_total = 0
	sales_count = 0
	returns_count = 0
	loyalty_redemption_total = 0

	if invoice_names:
		invoices = frappe.get_all(
			"Sales Invoice",
			filters={"name": ["in", invoice_names]},
			fields=["name", "grand_total", "base_grand_total", "conversion_rate", "is_return", "loyalty_amount"],
		)
		for inv in invoices:
			conversion_rate = flt(inv.conversion_rate) or 1
			base_grand_total = flt(inv.base_grand_total) or (flt(inv.grand_total) * conversion_rate)
			loyalty_amount = flt(inv.loyalty_amount)
			# A "full redeem" transaction is entirely paid via loyalty points and
			# contributes no real revenue, so it's excluded from gross sales.
			is_full_redeem = loyalty_amount > 0 and abs(loyalty_amount - flt(inv.grand_total)) < 0.005

			if inv.is_return:
				returns_total += abs(base_grand_total)
				returns_count += 1
			else:
				sales_count += 1
				if not is_full_redeem:
					sales_total += base_grand_total
				if loyalty_amount > 0:
					loyalty_redemption_total += loyalty_amount * conversion_rate

	result = doc.as_dict()
	result.update({
		"sales_total": sales_total,
		"returns_total": returns_total,
		"sales_count": sales_count,
		"returns_count": returns_count,
		"loyalty_redemption_total": loyalty_redemption_total,
	})

	return json.loads(json.dumps(result, default=str))

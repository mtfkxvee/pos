# -*- coding: utf-8 -*-
# Copyright (c) 2026, POS Next and contributors
# For license information, please see license.txt

"""Online Order API - browse Sales Orders for the current outlet, then turn
one into a Sales Invoice ("Siapkan") and, once invoiced, a Delivery Request
("Kirim").

Outlet scoping: both Sales Order and POS Profile carry a `custom_outlet`
Link field. An order is only visible to / actionable from a POS Profile
when their `custom_outlet` values match — this keeps online orders scoped
to the outlet the cashier is currently logged into.

Note on "Kirim" / Delivery Request: "Delivery Request" is a standalone
courier-ops doctype (from the separate `courier_app`) with no link field
back to Sales Order/Sales Invoice — it exists purely for the delivery/courier
side to track a drop-off (driver, address, status), not as an accounting
document. Once the Sales Invoice is created, the sale itself is already
complete as far as ERPNext/accounting is concerned; the Delivery Request
created here is best-effort denormalized data for tracking the delivery,
not a strictly-linked system record.
"""

import frappe
from frappe import _
from frappe.utils import flt


def _get_pos_profile_outlet(pos_profile):
	if not pos_profile:
		frappe.throw(_("POS Profile is required"))

	outlet = frappe.db.get_value("POS Profile", pos_profile, "custom_outlet")
	if not outlet:
		frappe.throw(_("POS Profile {0} has no Outlet configured").format(pos_profile))

	return outlet


def _check_pos_profile_access(pos_profile):
	has_access = frappe.db.exists(
		"POS Profile User", {"parent": pos_profile, "user": frappe.session.user}
	)
	if not has_access and not frappe.has_permission("Sales Order", "read"):
		frappe.throw(_("You don't have access to this POS Profile"))


@frappe.whitelist()
def get_sales_orders(pos_profile, page_size=20, page=1, search_term=None):
	"""List Sales Orders for the outlet linked to this POS Profile, newest first."""
	_check_pos_profile_access(pos_profile)
	outlet = _get_pos_profile_outlet(pos_profile)

	offset = (int(page) - 1) * int(page_size)

	conditions = ["so.custom_outlet = %(outlet)s", "so.docstatus = 1"]
	values = {"outlet": outlet, "page_size": int(page_size), "offset": offset}

	search_term = (search_term or "").strip()
	if search_term:
		conditions.append(
			"(so.name LIKE %(term)s OR so.customer_name LIKE %(term)s)"
		)
		values["term"] = f"%{search_term}%"

	where_clause = " AND ".join(conditions)

	return frappe.db.sql(
		f"""
		SELECT
			so.name, so.customer, so.customer_name, so.transaction_date,
			so.grand_total, so.status, so.per_billed, so.per_delivered,
			so.custom_payment_method, so.custom_payment_amount
		FROM `tabSales Order` so
		WHERE {where_clause}
		ORDER BY so.creation DESC
		LIMIT %(page_size)s OFFSET %(offset)s
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist()
def get_sales_order_detail(sales_order):
	"""Full Sales Order detail (header + items) for the Online Order detail view."""
	if not sales_order:
		frappe.throw(_("Sales Order is required"))

	so = frappe.get_doc("Sales Order", sales_order)
	if so.pos_profile:
		_check_pos_profile_access(so.pos_profile)

	# Find whether a Sales Invoice already exists for this order, so the
	# frontend can grey out "Siapkan" once already actioned. There is no
	# reliable way to check "already sent" for Delivery Request (no link
	# field back to this order — see module docstring), so "Kirim" is left
	# repeatable and is tracked client-side for the current session only.
	sales_invoice = frappe.db.get_value(
		"Sales Invoice Item",
		{"sales_order": sales_order, "docstatus": 1},
		"parent",
	)

	return {
		"name": so.name,
		"customer": so.customer,
		"customer_name": so.customer_name,
		"transaction_date": so.transaction_date,
		"delivery_date": so.delivery_date,
		"company": so.company,
		"status": so.status,
		"per_billed": so.per_billed,
		"per_delivered": so.per_delivered,
		"grand_total": so.grand_total,
		"net_total": so.net_total,
		"total_taxes_and_charges": so.total_taxes_and_charges,
		"custom_outlet": so.custom_outlet,
		"custom_payment_method": so.custom_payment_method,
		"custom_payment_amount": so.custom_payment_amount,
		"shipping_address": so.shipping_address_name,
		"items": [
			{
				"item_code": item.item_code,
				"item_name": item.item_name,
				"qty": item.qty,
				"uom": item.uom,
				"rate": item.rate,
				"amount": item.amount,
			}
			for item in so.items
		],
		"sales_invoice": sales_invoice,
	}


@frappe.whitelist()
def prepare_sales_invoice_from_order(sales_order, pos_profile, pos_opening_shift=None):
	"""'Siapkan': create + submit a Sales Invoice from a Sales Order, with the
	payment auto-filled from the order's custom_payment_method / custom_payment_amount.
	"""
	from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

	if not sales_order:
		frappe.throw(_("Sales Order is required"))

	_check_pos_profile_access(pos_profile)
	outlet = _get_pos_profile_outlet(pos_profile)

	so = frappe.get_doc("Sales Order", sales_order)

	if so.docstatus != 1:
		frappe.throw(_("Sales Order must be submitted"))

	if so.custom_outlet != outlet:
		frappe.throw(_("This order does not belong to your outlet"))

	if flt(so.per_billed) >= 100:
		frappe.throw(_("This order has already been fully invoiced"))

	if not so.custom_payment_method:
		frappe.throw(_("Sales Order {0} has no Payment Method set").format(sales_order))

	payment_amount = flt(so.custom_payment_amount)
	if payment_amount <= 0:
		frappe.throw(_("Sales Order {0} has no Payment Amount set").format(sales_order))

	si = make_sales_invoice(sales_order)
	si.is_pos = 1
	si.pos_profile = pos_profile
	if pos_opening_shift:
		si.posa_pos_opening_shift = pos_opening_shift

	si.set("payments", [])
	si.append("payments", {
		"mode_of_payment": so.custom_payment_method,
		"amount": payment_amount,
	})

	si.insert(ignore_permissions=False)
	si.submit()

	return {"sales_invoice": si.name}


# Best-effort mapping from a Mode of Payment name to Delivery Request's
# fixed "Pembayaran" Select options (COD/Transfer/Tunai/QRIS). If nothing
# matches, the field is simply left blank on the Delivery Request — it's a
# tracking form, easy for the courier/ops side to fill in by hand.
# This site's real Mode of Payment names are mostly "CASH <outlet>" (per-outlet
# cash accounts) or bank-specific transfer/debit methods (e.g. "TF BCA",
# "DEBIT BNI", "Wire Transfer") — there's no literal "QRIS"/"COD"/"Transfer"
# entry to match against. So: identify cash by keyword, identify COD/QRIS by
# keyword if ever added, and treat anything else as "Transfer" (the only
# other real category of payment method in use here).
_CASH_KEYWORDS = ("CASH", "TUNAI")


def _guess_delivery_request_payment_method(mode_of_payment):
	if not mode_of_payment:
		return None
	name = mode_of_payment.upper()
	if any(keyword in name for keyword in _CASH_KEYWORDS):
		return "Tunai"
	if "QRIS" in name:
		return "QRIS"
	if "COD" in name:
		return "COD"
	return "Transfer"


def _build_address_street(address_name, fallback_text=None):
	if address_name:
		address = frappe.db.get_value(
			"Address",
			address_name,
			["address_line1", "address_line2", "city"],
			as_dict=True,
		)
		if address:
			parts = [address.address_line1, address.address_line2, address.city]
			text = ", ".join(p for p in parts if p)
			if text:
				return text
	return fallback_text or _("Alamat belum diisi")


@frappe.whitelist()
def create_delivery_request_from_invoice(sales_order, sales_invoice, pos_profile):
	"""'Kirim': create a Delivery Request (courier_app) for this order's delivery.

	Delivery Request has no link field back to Sales Order/Sales Invoice — see
	module docstring. This is denormalized, best-effort tracking data for the
	delivery/courier side; the sale itself is already complete once the Sales
	Invoice exists. Any missing detail (address, payment method) can be filled
	in by hand afterwards on the Delivery Request itself.
	"""
	if not sales_order:
		frappe.throw(_("Sales Order is required"))
	if not sales_invoice:
		frappe.throw(_("Sales Invoice is required"))

	_check_pos_profile_access(pos_profile)
	outlet = _get_pos_profile_outlet(pos_profile)

	si = frappe.get_doc("Sales Invoice", sales_invoice)
	if si.docstatus != 1:
		frappe.throw(_("Sales Invoice must be submitted before sending"))
	if si.pos_profile != pos_profile:
		frappe.throw(_("This invoice does not belong to your outlet"))

	so = frappe.get_doc("Sales Order", sales_order)

	phone = so.contact_mobile or frappe.db.get_value("Customer", so.customer, "mobile_no") or ""
	address_street = _build_address_street(so.shipping_address_name or so.customer_address)

	product_lines = [f"{flt(item.qty):g}x {item.item_name}" for item in si.items]

	dr = frappe.new_doc("Delivery Request")
	dr.outlet = outlet
	dr.customer_name = so.customer_name or si.customer_name
	dr.phone = phone
	dr.payment_method = _guess_delivery_request_payment_method(so.custom_payment_method)
	dr.total_price = si.grand_total
	dr.address_street = address_street
	dr.product_purchased = ", ".join(product_lines)
	dr.product_qty = sum(flt(item.qty) for item in si.items)
	dr.notes = _("Online Order: {0} / Invoice: {1}").format(sales_order, sales_invoice)

	dr.insert(ignore_permissions=False)

	return {"delivery_request": dr.name}

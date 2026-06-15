# -*- coding: utf-8 -*-
import frappe
from frappe import _


@frappe.whitelist()
def get_delivery_notes(pos_profile, page_size=20, page=1):
	"""Return Sales Invoices with a shipping address (Delivery Note) for a POS Profile, newest first."""
	if not pos_profile:
		return []

	has_access = frappe.db.exists(
		"POS Profile User",
		{"parent": pos_profile, "user": frappe.session.user}
	)

	if not has_access and not frappe.has_permission("Sales Invoice", "read"):
		frappe.throw(_("You don't have access to this POS Profile"))

	offset = (int(page) - 1) * int(page_size)

	return frappe.db.sql(
		"""
		SELECT
			name, customer, customer_name, posting_date, posting_time,
			grand_total, custom_shipping_address
		FROM `tabSales Invoice`
		WHERE
			pos_profile = %(pos_profile)s
			AND docstatus = 1
			AND is_pos = 1
			AND custom_shipping_address IS NOT NULL
			AND custom_shipping_address != ''
		ORDER BY modified DESC
		LIMIT %(page_size)s OFFSET %(offset)s
		""",
		{"pos_profile": pos_profile, "page_size": int(page_size), "offset": offset},
		as_dict=True,
	)


@frappe.whitelist()
def set_delivery_address(invoice_name, shipping_address):
	"""Set the shipping address on a submitted Sales Invoice, marking it as a Delivery Note."""
	if not invoice_name:
		frappe.throw(_("Invoice name is required"))

	shipping_address = (shipping_address or "").strip()
	if not shipping_address:
		frappe.throw(_("Shipping address is required"))

	invoice = frappe.db.get_value(
		"Sales Invoice", invoice_name, ["docstatus", "pos_profile"], as_dict=True
	)
	if not invoice:
		frappe.throw(_("Invoice {0} does not exist").format(invoice_name))

	if invoice.docstatus != 1:
		frappe.throw(_("Delivery Note can only be created for submitted invoices"))

	has_access = frappe.db.exists(
		"POS Profile User",
		{"parent": invoice.pos_profile, "user": frappe.session.user}
	)

	if not has_access and not frappe.has_permission("Sales Invoice", "write", invoice_name):
		frappe.throw(_("You don't have permission to update this invoice"))

	frappe.db.set_value("Sales Invoice", invoice_name, "custom_shipping_address", shipping_address)

	return {"name": invoice_name, "custom_shipping_address": shipping_address}

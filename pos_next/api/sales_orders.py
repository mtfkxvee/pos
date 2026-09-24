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

Note on "Kirim" / Delivery Request: "Delivery Request" is a courier-ops
doctype (from the separate `courier_app`) used purely for the
delivery/courier side to track a drop-off (driver, address, status) — not
an accounting document. It does carry a `sales_invoice` Link field back to
the Sales Invoice, which is used here both to populate delivery data
(location, totals, etc.) and to detect/prevent duplicate Delivery Requests
for the same invoice. The sale itself is already complete as far as
ERPNext/accounting is concerned once the Sales Invoice exists — the
Delivery Request is tracking data layered on top.
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


def _check_pos_profile_access(pos_profile, doctype="Sales Order"):
	has_access = frappe.db.exists(
		"POS Profile User", {"parent": pos_profile, "user": frappe.session.user}
	)
	if not has_access and not frappe.has_permission(doctype, "read"):
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
def get_pending_sales_orders_count(pos_profile):
	"""Count Sales Orders for this outlet that haven't been invoiced yet
	(per_billed < 100) — used for the "Online Order" sidebar badge."""
	_check_pos_profile_access(pos_profile)
	outlet = _get_pos_profile_outlet(pos_profile)

	return frappe.db.count(
		"Sales Order",
		{
			"custom_outlet": outlet,
			"docstatus": 1,
			"per_billed": ["<", 100],
		},
	)


@frappe.whitelist()
def get_sales_order_detail(sales_order):
	"""Full Sales Order detail (header + items) for the Online Order detail view."""
	if not sales_order:
		frappe.throw(_("Sales Order is required"))

	so = frappe.get_doc("Sales Order", sales_order)
	if so.pos_profile:
		_check_pos_profile_access(so.pos_profile)

	# Find whether a Sales Invoice / Delivery Request already exists for this
	# order, so the frontend can grey out "Siapkan"/"Kirim" once already
	# actioned — persisted server-side via Delivery Request's sales_invoice
	# link, not just tracked for the current viewing session.
	sales_invoice = frappe.db.get_value(
		"Sales Invoice Item",
		{"sales_order": sales_order, "docstatus": 1},
		"parent",
	)
	delivery_request = None
	if sales_invoice:
		delivery_request = frappe.db.get_value(
			"Delivery Request", {"sales_invoice": sales_invoice}, "name"
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
		"delivery_request": delivery_request,
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
	si.custom_latitude = so.custom_latitude
	si.custom_longitude = so.custom_longitude

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

	Delivery Request is a courier-ops tracking doctype, not an accounting
	document — the sale itself is already complete once the Sales Invoice
	exists. It does have a `sales_invoice` Link field, which is used here to
	both record the reference and detect duplicates.
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

	existing = frappe.db.get_value("Delivery Request", {"sales_invoice": sales_invoice})
	if existing:
		frappe.throw(_("A Delivery Request ({0}) already exists for this invoice").format(existing))

	so = frappe.get_doc("Sales Order", sales_order)

	customer = so.customer or si.customer
	customer_info = frappe.db.get_value(
		"Customer", customer, ["mobile_no", "customer_group"], as_dict=True
	) or {}

	phone = so.contact_mobile or customer_info.get("mobile_no") or ""
	address_street = _build_address_street(so.shipping_address_name or so.customer_address)

	product_lines = [f"{flt(item.qty):g}x {item.item_name}" for item in si.items]

	dr = frappe.new_doc("Delivery Request")
	dr.outlet = outlet
	dr.delivery_type = "Sales Invoice"
	dr.sales_invoice = sales_invoice
	dr.customer_name = so.customer_name or si.customer_name
	dr.customer_category = customer_info.get("customer_group")
	dr.phone = phone
	dr.payment_method = _guess_delivery_request_payment_method(so.custom_payment_method)
	dr.total_price = si.grand_total
	dr.address_street = address_street
	dr.delivery_latitude = si.custom_latitude
	dr.delivery_longitude = si.custom_longitude
	dr.product_purchased = ", ".join(product_lines)
	dr.product_qty = sum(flt(item.qty) for item in si.items)
	dr.notes = _("Online Order: {0} / Invoice: {1}").format(sales_order, sales_invoice)

	dr.insert(ignore_permissions=False)

	return {"delivery_request": dr.name}


@frappe.whitelist()
def create_delivery_request_from_sales_invoice(sales_invoice, pos_profile):
	"""Create a bare-bones Delivery Request straight from a (regular, walk-in)
	Sales Invoice — used by the "Buat Delivery Request" action in Invoice
	History, where there is no originating Sales Order to pull address/payment
	details from. Only what's reliably known (customer, totals, coordinates)
	is filled in; the outlet team fills in the rest (address, driver, etc.)
	in the edit popup shown right after this call.
	"""
	if not sales_invoice:
		frappe.throw(_("Sales Invoice is required"))

	_check_pos_profile_access(pos_profile)
	outlet = _get_pos_profile_outlet(pos_profile)

	si = frappe.get_doc("Sales Invoice", sales_invoice)
	if si.docstatus != 1:
		frappe.throw(_("Sales Invoice must be submitted before creating a delivery request"))
	if si.pos_profile != pos_profile:
		frappe.throw(_("This invoice does not belong to your outlet"))

	existing = frappe.db.get_value("Delivery Request", {"sales_invoice": sales_invoice})
	if existing:
		frappe.throw(_("A Delivery Request ({0}) already exists for this invoice").format(existing))

	customer_info = frappe.db.get_value(
		"Customer", si.customer, ["mobile_no", "customer_group"], as_dict=True
	) or {}

	# Prefer the largest payment row's mode of payment as the guess (a POS sale
	# can have a "Cash" row plus a "wallet" or rounding-adjustment row).
	payment_mode = None
	if si.payments:
		payment_mode = max(si.payments, key=lambda p: abs(flt(p.amount))).mode_of_payment

	product_lines = [f"{flt(item.qty):g}x {item.item_name}" for item in si.items]

	dr = frappe.new_doc("Delivery Request")
	dr.outlet = outlet
	dr.delivery_type = "Sales Invoice"
	dr.sales_invoice = sales_invoice
	dr.customer_name = si.customer_name
	dr.customer_category = customer_info.get("customer_group")
	dr.phone = si.contact_mobile or customer_info.get("mobile_no") or ""
	dr.payment_method = _guess_delivery_request_payment_method(payment_mode)
	dr.total_price = si.grand_total
	dr.address_street = _build_address_street(si.customer_address)
	dr.delivery_latitude = si.custom_latitude
	dr.delivery_longitude = si.custom_longitude
	dr.product_purchased = ", ".join(product_lines)
	dr.product_qty = sum(flt(item.qty) for item in si.items)
	dr.notes = _("Invoice: {0}").format(sales_invoice)

	dr.insert(ignore_permissions=False)

	return {"delivery_request": dr.name}


@frappe.whitelist()
def get_delivery_requests(pos_profile, page_size=20, page=1):
	"""List Delivery Requests for the outlet linked to this POS Profile, newest first."""
	_check_pos_profile_access(pos_profile, doctype="Delivery Request")
	outlet = _get_pos_profile_outlet(pos_profile)

	offset = (int(page) - 1) * int(page_size)

	return frappe.db.sql(
		"""
		SELECT
			name, creation, customer_name, phone, delivery_status,
			payment_method, total_price, address_street, driver
		FROM `tabDelivery Request`
		WHERE outlet = %(outlet)s
		ORDER BY creation DESC
		LIMIT %(page_size)s OFFSET %(offset)s
		""",
		{"outlet": outlet, "page_size": int(page_size), "offset": offset},
		as_dict=True,
	)


# Fields the Online Order UI is allowed to edit on a Delivery Request. Kept
# to an explicit list rather than trusting the client with arbitrary fields.
_DELIVERY_REQUEST_EDITABLE_FIELDS = [
	"delivery_status", "driver", "vehicle_type",
	"customer_name", "customer_category", "phone",
	"payment_method", "total_price",
	"address_street", "address_landmark", "rt_rw", "village", "district",
	"delivery_latitude", "delivery_longitude",
	"item_location_note", "product_purchased", "product_qty",
	"notes", "issues",
]


def _get_delivery_request_for_profile(name, pos_profile):
	_check_pos_profile_access(pos_profile, doctype="Delivery Request")
	outlet = _get_pos_profile_outlet(pos_profile)

	dr = frappe.get_doc("Delivery Request", name)
	if dr.outlet != outlet:
		frappe.throw(_("This delivery request does not belong to your outlet"))
	return dr


@frappe.whitelist()
def get_delivery_request_detail(name, pos_profile):
	"""Full Delivery Request detail for the edit dialog."""
	if not name:
		frappe.throw(_("Delivery Request is required"))

	dr = _get_delivery_request_for_profile(name, pos_profile)
	return {field: dr.get(field) for field in ["name", "outlet", *_DELIVERY_REQUEST_EDITABLE_FIELDS]}


@frappe.whitelist()
def update_delivery_request(name, pos_profile, data):
	"""Update editable fields on a Delivery Request (courier/ops tracking edits)."""
	if not name:
		frappe.throw(_("Delivery Request is required"))
	if isinstance(data, str):
		data = frappe.parse_json(data)

	dr = _get_delivery_request_for_profile(name, pos_profile)

	for field in _DELIVERY_REQUEST_EDITABLE_FIELDS:
		if field in (data or {}):
			dr.set(field, data[field])

	dr.save(ignore_permissions=False)

	return {field: dr.get(field) for field in ["name", "outlet", *_DELIVERY_REQUEST_EDITABLE_FIELDS]}

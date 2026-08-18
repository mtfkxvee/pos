import frappe
from frappe import _
from frappe.utils import nowdate


@frappe.whitelist()
def get_order_tracking(date=None):
	"""Return today's Sales Order Tracking records (status != Done), newest first."""
	target_date = date or nowdate()

	records = frappe.get_all(
		"Sales Order Tracking",
		filters={"posting_date": target_date, "status": ["!=", "Done"]},
		fields=[
			"name", "order_number", "customer", "status",
			"grand_total", "items_summary", "sales_invoice", "creation",
		],
		order_by="order_number asc",
	)
	return records


@frappe.whitelist()
def update_order_status(name, status):
	"""Update the status of a Sales Order Tracking document."""
	allowed = {"Waiting", "Ready", "Done"}
	if status not in allowed:
		frappe.throw(_("Invalid status: {0}").format(status))

	doc = frappe.get_doc("Sales Order Tracking", name)
	doc.status = status
	doc.save(ignore_permissions=True)

	frappe.publish_realtime(
		"order_status_changed",
		{"name": name, "status": status, "order_number": doc.order_number},
	)
	return {"name": name, "status": status}

import frappe
from frappe import _
from frappe.utils import nowdate


@frappe.whitelist()
def get_order_tracking(date=None):
	"""Return today's Sales Order Tracking records (status != Complete)."""
	target_date = date or nowdate()

	records = frappe.get_all(
		"Sales Order Tracking",
		filters={"posting_date": target_date, "status": ["!=", "Complete"]},
		fields=["name", "customer", "status", "grand_total", "remarks", "sales_invoice", "creation"],
		order_by="creation asc",
	)

	for record in records:
		record["items"] = frappe.get_all(
			"Order Tracking Item",
			filters={"parent": record["name"]},
			fields=["item_name", "qty", "status"],
			order_by="idx asc",
		)

	return records


@frappe.whitelist()
def update_order_status(name, status):
	"""Update the status of a Sales Order Tracking document."""
	allowed = {"Order Placed", "On Progress", "Complete"}
	if status not in allowed:
		frappe.throw(_("Invalid status: {0}").format(status))

	doc = frappe.get_doc("Sales Order Tracking", name)
	doc.status = status
	doc.save(ignore_permissions=True)

	frappe.publish_realtime(
		"order_status_changed",
		{"name": name, "status": status},
	)
	return {"name": name, "status": status}

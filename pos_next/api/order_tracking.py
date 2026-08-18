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
		fields=["name", "customer", "status", "grand_total", "remarks", "serving", "sales_invoice", "creation"],
		order_by="creation asc",
	)

	for record in records:
		record["items"] = frappe.get_all(
			"Order Tracking Item",
			filters={"parent": record["name"], "parenttype": "Sales Order Tracking"},
			fields=["name", "item_name", "qty", "status"],
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

	# When setting On Progress, also update all items that haven't started
	if status == "On Progress":
		for item in doc.item_status:
			if item.status == "Order Placed":
				item.status = "On Progress"

	doc.save(ignore_permissions=True)

	frappe.publish_realtime(
		"order_status_changed",
		{"name": name, "status": status},
	)
	return {"name": name, "status": status}


@frappe.whitelist()
def update_item_status(parent, child_name, status):
	"""Update a single item row status and auto-complete order if all items done."""
	allowed = {"Order Placed", "On Progress", "Complete"}
	if status not in allowed:
		frappe.throw(_("Invalid status: {0}").format(status))

	doc = frappe.get_doc("Sales Order Tracking", parent)

	for item in doc.item_status:
		if item.name == child_name:
			item.status = status
			break

	# Auto-complete order if all items are Complete
	all_done = all(item.status == "Complete" for item in doc.item_status)
	if all_done:
		doc.status = "Complete"

	doc.save(ignore_permissions=True)

	if all_done:
		frappe.publish_realtime("order_status_changed", {"name": parent, "status": "Complete"})
	else:
		frappe.publish_realtime("item_status_changed", {
			"parent": parent,
			"child_name": child_name,
			"status": status,
		})

	return {"parent": parent, "child_name": child_name, "status": status, "order_complete": all_done}

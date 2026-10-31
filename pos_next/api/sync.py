# -*- coding: utf-8 -*-
"""Incremental offline sync for the desktop POS client (pos-desktop).

The desktop client keeps a local copy of the item catalog and the customer
list. Pulling both in full every couple of minutes from every device kept
the database permanently busy, so the client now sends back the server time
from its previous pull and only gets what changed since then.
"""

from datetime import timedelta

import frappe
from frappe.utils import get_datetime, now_datetime

from pos_next.api.customers import get_customers
from pos_next.api.items import get_items_bulk

# Re-send a few minutes of changes: a document saved just before the previous
# pull but committed after it would otherwise be missed for good.
OVERLAP = timedelta(minutes=5)


def _changed_since(since):
	return str(get_datetime(since) - OVERLAP) if since else None


@frappe.whitelist()
def get_items_delta(pos_profile, since=None):
	"""All POS items (variants included) when `since` is empty, else only the
	ones whose item, selling price or stock changed since then.

	Returns {"items": [...], "server_time": "<pass back as since next time>"}.
	"""
	server_time = str(now_datetime())
	items = get_items_bulk(
		pos_profile,
		limit=1000000,
		include_variants=1,
		changed_since=_changed_since(since),
	)
	return {"items": items, "server_time": server_time}


@frappe.whitelist()
def get_customers_delta(pos_profile, since=None):
	"""All customers of the profile when `since` is empty, else only the ones
	changed or given loyalty points since then.

	Returns {"customers": [...], "server_time": "<pass back as since next time>"}.
	"""
	server_time = str(now_datetime())
	changed_since = _changed_since(since)
	if not changed_since:
		return {"customers": get_customers(pos_profile=pos_profile, limit=0), "server_time": server_time}

	names = set(frappe.get_all("Customer", filters={"modified": [">", changed_since]}, pluck="name"))
	# Loyalty points live on Loyalty Point Entry, not on the Customer itself
	names.update(
		frappe.get_all(
			"Loyalty Point Entry",
			filters={"modified": [">", changed_since]},
			pluck="customer",
			distinct=True,
		)
	)
	names.discard(None)

	customers = get_customers(pos_profile=pos_profile, limit=0, customer_names=list(names)) if names else []
	return {"customers": customers, "server_time": server_time}

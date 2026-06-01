import json
import frappe
from pos_next.api.items import get_items as _get_items


@frappe.whitelist()
def get_pinned_items(pos_profile):
    key = f"pos_pinned_items_{pos_profile}"
    raw = frappe.db.get_value(
        "DefaultValue",
        {"defkey": key, "parent": "__default"},
        "defvalue",
    )
    return json.loads(raw) if raw else []


@frappe.whitelist()
def toggle_pinned_item(pos_profile, item_code):
    key = f"pos_pinned_items_{pos_profile}"
    raw = frappe.db.get_value(
        "DefaultValue",
        {"defkey": key, "parent": "__default"},
        "defvalue",
    )
    pinned = json.loads(raw) if raw else []

    if item_code in pinned:
        pinned.remove(item_code)
        is_pinned = False
    else:
        pinned.insert(0, item_code)
        is_pinned = True

    frappe.defaults.set_global_default(key, json.dumps(pinned))
    frappe.db.commit()

    return {"is_pinned": is_pinned, "pinned_items": pinned}


@frappe.whitelist()
def get_pinned_item_details(pos_profile, item_codes):
    """Fetch full item details (price, stock, UOM, barcodes) for pinned item codes."""
    if isinstance(item_codes, str):
        item_codes = frappe.parse_json(item_codes)
    if not item_codes:
        return []

    results = []
    for code in item_codes:
        items = _get_items(pos_profile=pos_profile, search_term=code, limit=10)
        match = next((i for i in (items or []) if i.get("item_code") == code), None)
        if match:
            results.append(match)
    return results

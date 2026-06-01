import json
import frappe


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

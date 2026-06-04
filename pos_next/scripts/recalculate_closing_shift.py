"""
Script to recalculate POS Closing Shift totals from actual invoice data.

Usage (run from frappe-bench):
    bench --site erp.x-sha.id execute pos_next.scripts.recalculate_closing_shift.run

Or to recalculate specific shifts only:
    bench --site erp.x-sha.id execute pos_next.scripts.recalculate_closing_shift.run \
        --args "['POSA-CS-26-0000248', 'POSA-CS-26-0000266']"
"""

import frappe
from frappe.utils import flt
from pos_next.pos_next.doctype.pos_closing_shift.pos_closing_shift import (
    get_pos_invoices,
    _process_invoice,
    _aggregate_payment,
    _get_cash_mode_of_payment,
    get_payments_entries,
    get_base_value,
)


def run(closing_shift_names=None):
    """
    Recalculate totals for given closing shifts (or the hardcoded defaults).

    Args:
        closing_shift_names: list of closing shift names, or None to use defaults
    """
    if not closing_shift_names:
        closing_shift_names = [
            "POSA-CS-26-0000248",
            "POSA-CS-26-0000266",
        ]

    if isinstance(closing_shift_names, str):
        import json
        closing_shift_names = json.loads(closing_shift_names)

    results = []
    for cs_name in closing_shift_names:
        result = _recalculate_one(cs_name)
        results.append(result)
        print(result["message"])

    return results


def _recalculate_one(cs_name):
    if not frappe.db.exists("POS Closing Shift", cs_name):
        return {"name": cs_name, "message": f"[SKIP] {cs_name} — tidak ditemukan"}

    cs_doc = frappe.get_doc("POS Closing Shift", cs_name)
    opening_shift_name = cs_doc.pos_opening_shift

    old_grand_total = flt(cs_doc.grand_total)
    old_net_total   = flt(cs_doc.net_total)

    # Fetch all invoices linked to opening shift (no time filter)
    invoices = get_pos_invoices(opening_shift_name)
    if not invoices:
        return {
            "name": cs_name,
            "message": f"[SKIP] {cs_name} — tidak ada invoice ditemukan untuk {opening_shift_name}",
        }

    company = cs_doc.company or frappe.db.get_value(
        "POS Opening Shift", opening_shift_name, "company"
    )
    company_currency = frappe.get_cached_value("Company", company, "default_currency") if company else "IDR"
    cash_mode = _get_cash_mode_of_payment(cs_doc.pos_profile)

    payments = []
    taxes = []
    pos_transactions = []
    summary = {
        "grand_total": 0, "net_total": 0, "total_quantity": 0,
        "returns_total": 0, "returns_count": 0,
        "sales_total": 0, "sales_count": 0,
    }

    # Seed payments with opening balances
    opening_shift_doc = frappe.get_doc("POS Opening Shift", opening_shift_name)
    for detail in opening_shift_doc.get("balance_details", []):
        opening_amount = flt(detail.get("amount"))
        payments.append(frappe._dict({
            "mode_of_payment": detail.get("mode_of_payment"),
            "opening_amount": opening_amount,
            "expected_amount": opening_amount,
        }))

    # Process all invoices
    for invoice in invoices:
        txn = _process_invoice(
            invoice, "posa_pos_opening_shift",
            company_currency, cash_mode, payments, taxes, summary
        )
        pos_transactions.append(txn)

    # Process payment entries
    pos_payments_table = []
    for py in get_payments_entries(opening_shift_name):
        pos_payments_table.append(frappe._dict({
            "payment_entry": py.name,
            "mode_of_payment": py.mode_of_payment,
            "paid_amount": py.paid_amount,
            "posting_date": py.posting_date,
            "customer": py.party,
        }))
        amount = get_base_value(py, "paid_amount", "base_paid_amount")
        _aggregate_payment(payments, py.mode_of_payment, amount)

    new_grand_total = summary["grand_total"]
    new_net_total   = summary["net_total"]

    # Update scalar fields directly (bypass docstatus=1 restriction)
    frappe.db.set_value("POS Closing Shift", cs_name, {
        "grand_total":    new_grand_total,
        "net_total":      new_net_total,
        "total_quantity": summary["total_quantity"],
    }, update_modified=False)

    # Replace child tables
    frappe.db.delete("POS Closing Shift Detail", {"parent": cs_name})
    frappe.db.delete("POS POS Payment Detail",   {"parent": cs_name, "parentfield": "payment_reconciliation"})
    frappe.db.delete("POS Tax Detail",            {"parent": cs_name})
    frappe.db.delete("POS Closing Shift Payment", {"parent": cs_name})

    for txn in pos_transactions:
        row = {k: v for k, v in txn.items() if k not in ("is_return", "return_against")}
        row.update({"parent": cs_name, "parenttype": "POS Closing Shift", "parentfield": "pos_transactions"})
        frappe.db.insert("POS Closing Shift Detail", row)

    for i, p in enumerate(payments):
        frappe.db.insert("POS POS Payment Detail", {
            **p,
            "parent": cs_name, "parenttype": "POS Closing Shift",
            "parentfield": "payment_reconciliation", "idx": i + 1,
        })

    for i, t in enumerate(taxes):
        frappe.db.insert("POS Tax Detail", {
            **t,
            "parent": cs_name, "parenttype": "POS Closing Shift",
            "parentfield": "taxes", "idx": i + 1,
        })

    for i, py in enumerate(pos_payments_table):
        frappe.db.insert("POS Closing Shift Payment", {
            **py,
            "parent": cs_name, "parenttype": "POS Closing Shift",
            "parentfield": "pos_payments", "idx": i + 1,
        })

    frappe.db.commit()

    diff = new_grand_total - old_grand_total
    inv_count = len(invoices)
    return {
        "name":      cs_name,
        "old_total": old_grand_total,
        "new_total": new_grand_total,
        "diff":      diff,
        "invoices":  inv_count,
        "message": (
            f"[OK] {cs_name} | "
            f"{inv_count} invoice | "
            f"grand_total: {old_grand_total:,.0f} → {new_grand_total:,.0f} "
            f"(+{diff:,.0f})"
        ),
    }

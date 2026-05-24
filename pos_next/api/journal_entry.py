# -*- coding: utf-8 -*-
import json
import frappe
from frappe import _
from frappe.utils import flt, nowdate


@frappe.whitelist()
def get_expense_accounts(company):
	"""Return all active leaf expense accounts for the given company."""
	return frappe.get_all(
		"Account",
		filters={"company": company, "disabled": 0, "is_group": 0, "root_type": "Expense"},
		fields=["name", "account_name"],
		order_by="name asc",
	)


@frappe.whitelist()
def get_payment_accounts(company):
	"""Return active Cash/Bank accounts for the credit side."""
	return frappe.get_all(
		"Account",
		filters={
			"company": company,
			"disabled": 0,
			"is_group": 0,
			"account_type": ["in", ["Cash", "Bank"]],
		},
		fields=["name", "account_name"],
		order_by="name asc",
	)


@frappe.whitelist()
def get_journal_entries(pos_profile, page_size=20, page=1):
	"""Return Journal Entries whose account rows share the POS Profile's cost_center."""
	cost_center = frappe.db.get_value("POS Profile", pos_profile, "cost_center")
	if not cost_center:
		return []

	offset = (int(page) - 1) * int(page_size)

	return frappe.db.sql(
		"""
		SELECT DISTINCT
			je.name,
			je.posting_date,
			je.total_debit,
			je.docstatus,
			je.user_remark
		FROM `tabJournal Entry` je
		INNER JOIN `tabJournal Entry Account` jea ON jea.parent = je.name
		WHERE jea.cost_center = %(cost_center)s
		  AND je.docstatus != 2
		ORDER BY je.posting_date DESC, je.creation DESC
		LIMIT %(page_size)s OFFSET %(offset)s
		""",
		{"cost_center": cost_center, "page_size": int(page_size), "offset": offset},
		as_dict=True,
	)


@frappe.whitelist()
def create_journal_entry(pos_profile, posting_date, user_remark, expense_rows, credit_account, submit=False):
	"""
	Create a Journal Entry for operational expenses.

	expense_rows: JSON list of {account, amount, description}
	credit_account: account to credit (cash/bank)
	"""
	if isinstance(expense_rows, str):
		expense_rows = json.loads(expense_rows)

	if not expense_rows:
		frappe.throw(_("Please add at least one expense entry."))

	company = frappe.db.get_value("POS Profile", pos_profile, "company")
	cost_center = frappe.db.get_value("POS Profile", pos_profile, "cost_center")

	if not company:
		frappe.throw(_("Could not determine company from POS Profile."))

	total = sum(flt(r.get("amount") or 0) for r in expense_rows)
	if total <= 0:
		frappe.throw(_("Total amount must be greater than zero."))

	je = frappe.new_doc("Journal Entry")
	je.voucher_type = "Journal Entry"
	je.posting_date = posting_date or nowdate()
	je.company = company
	je.user_remark = user_remark or ""

	# Debit rows — expense accounts
	for row in expense_rows:
		amount = flt(row.get("amount") or 0)
		if not amount:
			continue
		je.append(
			"accounts",
			{
				"account": row["account"],
				"debit_in_account_currency": amount,
				"credit_in_account_currency": 0,
				"cost_center": cost_center,
				"user_remark": row.get("description") or "",
			},
		)

	# Credit row — payment account
	je.append(
		"accounts",
		{
			"account": credit_account,
			"debit_in_account_currency": 0,
			"credit_in_account_currency": total,
			"cost_center": cost_center,
			"user_remark": user_remark or "",
		},
	)

	je.flags.ignore_permissions = True
	je.insert()

	if submit or str(submit).lower() in ("true", "1"):
		je.submit()

	return {"name": je.name, "docstatus": je.docstatus, "total_debit": je.total_debit}

# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import json
from frappe import _
from frappe.utils import cint


@frappe.whitelist()
def get_csrf_token():
	"""
	Get CSRF token for the current session.
	Only returns CSRF token if user is authenticated with a valid session.

	Security checks:
	- User must be authenticated (not Guest)
	- Session must be valid
	- User must be enabled
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.AuthenticationError)

	if not frappe.db.get_value("User", frappe.session.user, "enabled"):
		frappe.throw(_("User is disabled"), frappe.AuthenticationError)

	if not frappe.session.sid or frappe.session.sid == "Guest":
		frappe.throw(_("Invalid session"), frappe.AuthenticationError)

	csrf_token = frappe.sessions.get_csrf_token()

	if not csrf_token:
		frappe.throw(_("Failed to generate CSRF token"), frappe.ValidationError)

	return {
		"csrf_token": csrf_token,
		"session_id": frappe.session.sid
	}


@frappe.whitelist()
def get_app_build_info():
	"""
	Return the build version of the currently deployed frontend assets.

	The frontend bakes its own build version into the bundle at compile time
	(__BUILD_VERSION__) and compares it against this value to detect when a
	newer build has been deployed to the server — prompting the cashier to
	hard-refresh before continuing transactions.
	"""
	from pos_next.utils import get_app_version, get_build_version

	return {
		"build_version": get_build_version(),
		"app_version": get_app_version(),
	}


@frappe.whitelist()
def log_client_error(title=None, message=None, context=None):
	"""
	Record a client-side error in the Frappe Error Log so support staff can
	diagnose issues (e.g. Speed Mode auto-sync failures) without needing
	access to the cashier's browser console.
	"""
	if isinstance(context, str):
		try:
			context = json.loads(context)
		except Exception:
			pass

	payload = {
		"user": frappe.session.user,
		"timestamp": frappe.utils.now(),
		"message": message,
		"context": context,
	}

	frappe.log_error(
		title=(title or "POS Client Error")[:140],
		message=json.dumps(payload, indent=2, default=str),
	)

	return {"logged": True}


def _parse_list_parameter(value, param_name="parameter"):
	"""
	Parse a list parameter that may come as JSON string or list.

	Args:
		value: Value to parse (string or list)
		param_name: Name of parameter for error messages

	Returns:
		list: Parsed list value
	"""
	if isinstance(value, str):
		try:
			value = value.strip()
			return json.loads(value) if value else []
		except json.JSONDecodeError as e:
			frappe.throw(_("Could not parse '{0}' as JSON: {1}").format(param_name, str(e)))

	if not isinstance(value, list):
		return []

	return value


def check_user_company():
	"""Check if the authenticated user has a company linked to them."""
	user = frappe.session.user

	permission = frappe.db.get_value(
		"User Permission",
		{"user": user, "allow": "Company"},
		["for_value"],
		as_dict=True
	)

	if permission:
		company_name = frappe.db.get_value("Company", permission.for_value, "company_name")
		return {"has_company": True, "company": company_name or ""}

	return {"has_company": False, "company": ""}


def get_wallet_payment_modes():
	"""
	Get list of Mode of Payment names that are marked as wallet payments.

	Returns:
		list: List of Mode of Payment names with is_wallet_payment=1
	"""
	return frappe.get_all(
		"Mode of Payment",
		filters={"is_wallet_payment": 1},
		pluck="name"
	)


def is_wallet_payment_mode(mode_of_payment):
	"""
	Check if a Mode of Payment is a wallet payment.

	Args:
		mode_of_payment: Mode of Payment name

	Returns:
		bool: True if the mode is a wallet payment
	"""
	if not mode_of_payment:
		return False

	return cint(frappe.get_cached_value("Mode of Payment", mode_of_payment, "is_wallet_payment"))

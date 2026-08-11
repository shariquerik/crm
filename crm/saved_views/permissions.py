# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Give Sales Manager the shared sidebar.

The framework grants a Desk User write on their own Saved Views and Navigation Sections
only, and reads "may write a record I do not own" as the right to change the shared ones.
CRM's manager is Sales Manager, so it gets that unrestricted row. Anyone can widen or
narrow this afterwards from the Role Permission Manager.
"""

import frappe
from frappe.permissions import add_permission, update_permission_property


def grant_sidebar_management(role="Sales Manager"):
	for doctype in ("Saved View", "Navigation Section"):
		if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
			continue

		add_permission(doctype, role, 0, "write")
		for right in ("read", "create", "delete"):
			update_permission_property(doctype, role, 0, right, 1)

import frappe
from frappe.desk.doctype.navigation_section.scope import UNSET

from crm.saved_views.scope import CRM_APP


def execute():
	"""Stamp `app` onto the Navigation Sections seeded before sections had one."""
	frappe.db.set_value(
		"Navigation Section",
		{"app": UNSET},
		"app",
		CRM_APP,
		update_modified=False,
	)

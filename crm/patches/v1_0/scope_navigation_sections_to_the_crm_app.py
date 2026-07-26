import frappe

from crm.saved_views.scope import CRM_APP


def execute():
	"""Stamp `app` onto the Navigation Sections seeded before sections had one.

	Every section on an existing site was made by this app's seeder or by a user in
	its sidebar, so they are all CRM's. Written straight to the column rather than
	recreated: recreating would unplace every view these sections hold, dropping a
	user's arrangement and leaving the seeded views orphaned in the pool.
	"""
	frappe.db.set_value(
		"Navigation Section",
		{"app": ("in", ("", None))},
		"app",
		CRM_APP,
		update_modified=False,
	)

# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Seeding the sidebar of a doctype that has just been put on the navigation."""

from frappe.desk.doctype.navigation_item.navigation_item import DOCTYPE

from crm.saved_views.scope import CRM_APP
from crm.saved_views.seed import seed_all_view


def seed_views_for_new_doctype_items(doc, method=None):
	"""`doc_events` reaches every app's sections, and the views seeded here land in CRM's
	scope — so another app's navigation would grow a CRM sidebar it never asked for."""
	if doc.app != CRM_APP:
		return

	for doctype in added_doctypes(doc):
		seed_all_view(doctype)


def added_doctypes(doc) -> list[str]:
	"""The doctypes this save put on the section that were not on it before."""
	previous = doc.get_doc_before_save()
	stored = {item.name for item in previous.items} if previous else set()
	return [item.dt for item in doc.items if item.type == DOCTYPE and item.dt and item.name not in stored]

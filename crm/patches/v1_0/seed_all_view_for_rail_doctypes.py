import json

import frappe

from crm.fcrm.doctype.crm_ui_customization.crm_ui_customization import get_sidebar_layout
from crm.saved_views.seed import seed_all_view


def execute():
	"""Give every doctype already on a rail the shared "Views" section it would get
	today, so a list added by hand before `update_rail_layout` seeded one stops falling
	back to the virtual All — the row that names no view and leaves the breadcrumb
	reading only the doctype.

	Idempotent: `seed_all_view` gates on the section, so the built-in doctypes keep the
	sections they were seeded with and nothing a manager deleted comes back."""
	for doctype in rail_doctypes():
		if frappe.db.exists("DocType", doctype):
			seed_all_view(doctype)


def rail_doctypes() -> set[str]:
	"""Every rail there is: the shared layout, plus each user's own once they have
	customized theirs. A user's record holds the flat item list; only the shared one
	keeps the sectioned shape, which `get_sidebar_layout` reads."""
	doctypes = {
		item.get("dt") for section in get_sidebar_layout() or [] for item in section.get("items") or []
	}

	for raw in frappe.get_all(
		"CRM UI Customization",
		filters={"type": "App Sidebar", "user": ("!=", "")},
		pluck="json",
	):
		doctypes.update(item.get("dt") for item in json.loads(raw or "[]"))

	return {doctype for doctype in doctypes if doctype}

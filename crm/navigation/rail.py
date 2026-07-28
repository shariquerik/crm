# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""The rail's navigation: CRM's app-level Navigation Sections."""

import frappe
from frappe.desk.doctype.navigation_item.navigation_item import DOCTYPE
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope

from crm.saved_views.scope import CRM_APP

RAIL_SCOPE = Scope(CRM_APP, "")

DEFAULT_SECTION_LABEL = "CRM"

DEFAULT_RAIL = (
	("Leads", "CRM Lead", "users"),
	("Deals", "CRM Deal", "handshake"),
	("Contacts", "Contact", "contact-round"),
	("Organizations", "CRM Organization", "building-2"),
	("Tasks", "CRM Task", "list-checks"),
	("Notes", "FCRM Note", "notebook-pen"),
)


def seed_rail():
	"""The rail every fresh site opens with: `DEFAULT_RAIL`, in order."""
	if shared_rail_exists():
		return

	items = rail_items(DEFAULT_RAIL)
	if items:
		create_rail_section(DEFAULT_SECTION_LABEL, 1, items)


@frappe.whitelist()
def addable_doctypes() -> list[str]:
	"""Every doctype the rail may show: one the session user can read."""
	names = frappe.get_all("DocType", filters={"issingle": 0, "istable": 0}, pluck="name", order_by="name")
	return [name for name in names if frappe.has_permission(name, "read")]


def shared_rail_exists() -> bool:
	return bool(
		frappe.db.exists(
			"Navigation Section",
			{**RAIL_SCOPE.filters(), "user": UNSET, "overrides": UNSET},
		)
	)


def rail_items(entries) -> list[dict]:
	"""The defaults as navigation rows. One naming a doctype the site does not have is
	dropped rather than left to fail the Link check on insert — these are CRM's own
	doctypes, but a site may have removed one."""
	return [
		{"type": DOCTYPE, "label": label, "icon": icon, "dt": doctype}
		for label, doctype, icon in entries
		if frappe.db.exists("DocType", doctype)
	]


def create_rail_section(label: str, sequence: int, items: list[dict]):
	frappe.get_doc(
		{
			"doctype": "Navigation Section",
			"label": label,
			**RAIL_SCOPE.as_fields(),
			"user": "",
			"sequence": sequence,
			"items": items,
		}
	).insert(ignore_permissions=True)

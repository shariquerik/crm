# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""The rail's navigation: CRM's app-level Navigation Sections.

An app-level section — one naming no doctype — is navigation that belongs to the app
rather than to any one list, which is what a rail is. The rail reads every one of them
and flattens them into a single ordered list, so a section's label never shows.

Seeded once, on install, and a real record from then on — not a read-through view of
the defaults below. Materializing it later would give every row a new name, and a row's
name is the identity personal overlays point at, so the copy is taken while nothing
points at anything. The cost is that editing `DEFAULT_RAIL` no longer reaches a site
already installed, which is the same trade the fixture this replaced made.
"""

import frappe
from frappe.desk.doctype.navigation_item.navigation_item import DOCTYPE
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope

from crm.saved_views.scope import CRM_APP

RAIL_SCOPE = Scope(CRM_APP, "")

DEFAULT_SECTION_LABEL = "CRM"

# The rail a fresh site opens with, as `(label, doctype, icon)`. Icons are bare Lucide
# sprite names — a name the sprite has retired draws nothing.
DEFAULT_RAIL = (
	("Leads", "CRM Lead", "users"),
	("Deals", "CRM Deal", "handshake"),
	("Contacts", "Contact", "contact-round"),
	("Organizations", "CRM Organization", "building-2"),
	("Tasks", "CRM Task", "list-checks"),
	("Notes", "FCRM Note", "notebook-pen"),
)


def seed_rail():
	"""The rail every fresh site opens with: `DEFAULT_RAIL`, in order.

	Gated on the whole scope rather than on one section, so a site whose rail has been
	arranged — or emptied — is left as its owner left it.
	"""
	if shared_rail_exists():
		return

	items = rail_items(DEFAULT_RAIL)
	if items:
		create_rail_section(DEFAULT_SECTION_LABEL, 1, items)


@frappe.whitelist()
def addable_doctypes() -> list[str]:
	"""Every doctype the rail may show: one the session user can read.

	Also the shell's validity gate — a URL naming no real doctype is absent from this
	list, which is how "/nonsense" is told from a list nobody has added yet.
	"""
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

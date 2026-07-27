# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""The rail's navigation: CRM's app-level Navigation Sections.

An app-level section — one naming no doctype — is navigation that belongs to the app
rather than to any one list, which is what a rail is. The rail reads every one of them
and flattens them into a single ordered list, so a section's label never shows.

Seeded once, on install, from the shared "App Sidebar" fixture. A real record, not a
read-through view of the fixture: materializing it later would give every row a new
name, and a row's name is the identity personal overlays point at. The copy is taken
while nothing points at anything, which costs later fixture edits their reach — already
true in practice, since a user who touched their rail stopped seeing shared changes at
all.
"""

import json

import frappe
from frappe.desk.doctype.navigation_item.navigation_item import DOCTYPE
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope

from crm.saved_views.scope import CRM_APP

RAIL_SCOPE = Scope(CRM_APP, "")

SHARED_SIDEBAR = "App Sidebar"


def seed_rail():
	"""The rail every fresh site opens with: the fixture's doctypes, in its order, with
	its labels and icons.

	Gated on the whole scope rather than on one section, so a site whose rail has been
	arranged — or emptied — is left as its owner left it.
	"""
	if shared_rail_exists():
		return

	for sequence, section in enumerate(shared_sidebar_layout(), start=1):
		label = section.get("label") or section.get("name")
		items = rail_items(section.get("items") or [])
		if label and items:
			create_rail_section(label, sequence, items)


def shared_sidebar_layout() -> list[dict]:
	"""The shared "App Sidebar" layout, read off the fixture file rather than the record
	`get_sidebar_layout` reads.

	Two reasons, and either alone would decide it: `sync_fixtures` runs *after*
	`after_install`, so on a fresh site the record does not exist yet; and it rewrites
	the record from this file on every migrate, so the file is what the record says.
	"""
	path = frappe.get_app_path("crm", "fixtures", "crm_ui_customization.json")
	records = json.loads(frappe.read_file(path) or "[]")
	for record in records:
		if record.get("type") == SHARED_SIDEBAR and not record.get("user"):
			return json.loads(record.get("json") or "[]")
	return []


def shared_rail_exists() -> bool:
	return bool(
		frappe.db.exists(
			"Navigation Section",
			{**RAIL_SCOPE.filters(), "user": UNSET, "overrides": UNSET},
		)
	)


def rail_items(entries: list[dict]) -> list[dict]:
	"""The fixture's entries as navigation rows. One naming a doctype the site does not
	have is dropped rather than left to fail the Link check on insert — the fixture is
	CRM's own, but a site may have removed one."""
	rows = [entry for entry in entries if entry.get("dt") and frappe.db.exists("DocType", entry["dt"])]
	return [
		{
			"type": DOCTYPE,
			"label": entry.get("label") or entry["dt"],
			"icon": entry.get("icon"),
			"dt": entry["dt"],
		}
		for entry in rows
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

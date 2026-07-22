# The rail's layout endpoints: per-user arrangement stored in CRM UI Customization,
# falling back to the shared "App Sidebar" record read by get_sidebar_layout.

import json

import frappe
from frappe import _

from crm.api.doc import _is_listable
from crm.fcrm.doctype.crm_ui_customization.crm_ui_customization import get_sidebar_layout
from crm.saved_views.seed import seed_all_view


@frappe.whitelist()
def get_rail_layout() -> dict:
	"""The session user's rail items, falling back to the shared layout until
	they customize it. Anything they remove is re-addable from the full doctype
	list, so nothing is kept aside."""
	return {"items": _user_items() or _flatten(get_sidebar_layout())}


@frappe.whitelist()
def update_rail_layout(items: list | str) -> dict:
	"""Replace the session user's rail, in order. Each entry is `{dt, label, icon}`;
	`icon` is a bare Lucide name, and either may be empty to fall back to the
	shared layout's value.

	A doctype arriving on the rail for the first time is seeded with the shared "Views"
	section the built-in ones ship with, so every list opens the same way. Seeding is
	shared rather than personal because the section it creates carries no opinion — an
	unfiltered All — and a personal one would leave the next user to seed their own."""
	if isinstance(items, str):
		items = json.loads(items)
	if not items:
		frappe.throw(_("The sidebar needs at least one item"))

	previous = {item["dt"] for item in get_rail_layout()["items"]}
	shared = {item["dt"]: item for item in _flatten(get_sidebar_layout())}
	saved = [_as_item(entry, shared) for entry in items]
	_save_user_items(saved)

	for item in saved:
		if item["dt"] not in previous:
			seed_all_view(item["dt"])

	return get_rail_layout()


@frappe.whitelist()
def addable_doctypes() -> list[str]:
	"""Every doctype the rail may show: listable by the session user."""
	names = frappe.get_all("DocType", filters={"issingle": 0, "istable": 0}, pluck="name", order_by="name")
	return [name for name in names if frappe.has_permission(name, "read")]


def _as_item(entry: dict, shared: dict) -> dict:
	doctype = entry.get("dt")
	if not doctype or not frappe.db.exists("DocType", doctype) or not _is_listable(doctype):
		frappe.throw(_("{0} cannot be shown in the sidebar").format(doctype))

	base = shared.get(doctype) or {}
	icon = (entry.get("icon") or "").removeprefix("lucide-").strip()
	label = (entry.get("label") or "").strip()
	return {
		"dt": doctype,
		"label": label or base.get("label") or doctype,
		"icon": icon or base.get("icon"),
		"type": "doctype",
	}


def _user_items() -> list | None:
	raw = frappe.db.get_value(
		"CRM UI Customization",
		{"type": "App Sidebar", "user": frappe.session.user, "disabled": 0},
		"json",
	)
	return json.loads(raw) if raw else None


def _save_user_items(items: list) -> None:
	# Per-user records hold the flat item list; only the shared "App Sidebar"
	# record keeps upstream's sectioned shape.
	filters = {"type": "App Sidebar", "user": frappe.session.user}
	name = frappe.db.exists("CRM UI Customization", filters)
	if name:
		doc = frappe.get_doc("CRM UI Customization", name)
	else:
		doc = frappe.new_doc("CRM UI Customization")
		doc.type = "App Sidebar"
		doc.user = frappe.session.user
	doc.json = json.dumps(items)
	doc.save(ignore_permissions=True)


def _flatten(sections: list) -> list[dict]:
	return [item for section in sections or [] for item in section.get("items") or []]

# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Migrate legacy CRM View Settings into framework Saved Views and Sections."""

import json

import frappe
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope
from frappe.desk.doctype.saved_view.api import get_or_create_section

from crm.saved_views.scope import CRM_APP

COPIED_FIELDS = (
	"order_by",
	"columns",
	"rows",
	"group_by_field",
	"column_field",
	"title_field",
	"kanban_columns",
	"kanban_fields",
)


def migrate_crm_view_settings():
	for legacy in frappe.get_all("CRM View Settings", fields=["*"]):
		migrate_view(legacy)


def migrate_view(legacy):
	if not legacy.dt:
		return

	user, is_default, placement = classify(legacy)
	filters = migrate_filters(legacy.filters)
	if migrated_view_exists(legacy, user, is_default, filters):
		return

	view = create_view(legacy, user, is_default, filters)
	if placement:
		place_in_section(legacy.dt, placement, user, view.name)


def classify(legacy):
	"""What the legacy flags translate to: `(user, is_default, placement)`, where
	placement is the section to drop the view into or `None` for a pool/default view."""
	if legacy.is_standard:
		return legacy.user or "", 1, None
	if legacy.public:
		return "", 0, "Views"
	if legacy.pinned:
		return legacy.user or "", 0, "Personal"
	return legacy.user or "", 0, None


def create_view(legacy, user, is_default, filters):
	return frappe.get_doc(
		{
			"doctype": "Saved View",
			"label": legacy.label or "View",
			"icon": legacy.icon,
			"reference_doctype": legacy.dt,
			"type": legacy.type or "list",
			"user": user,
			"is_default": is_default,
			"filters": filters,
			**{field: legacy.get(field) for field in COPIED_FIELDS},
		}
	).insert(ignore_permissions=True)


def migrate_filters(raw):
	"""CRM's `{fieldname: value}` / `{fieldname: [operator, value]}` dict into the
	framework's `[[fieldname, operator, value]]` list. A bare value is an equals."""
	data = parse_json(raw)
	if not isinstance(data, dict):
		return json.dumps([])

	wire = []
	for fieldname, condition in data.items():
		if isinstance(condition, list) and len(condition) == 2:
			wire.append([fieldname, condition[0], condition[1]])
		else:
			wire.append([fieldname, "=", condition])
	return json.dumps(wire)


def place_in_section(doctype, label, user, view_name):
	section = get_or_create_section(Scope(CRM_APP, doctype), label, user)
	if str(view_name) not in {str(row.view) for row in section.items}:
		section.append("items", {"type": "view", "view": view_name})
		section.save(ignore_permissions=True)


def migrated_view_exists(legacy, user, is_default, filters):
	"""A legacy record counts as already migrated only when a Saved View matches it
	down to its filters. Label alone would let a seeded default (same label, its own
	filters) shadow a user's view of that name and drop it — the site would lose a
	view it had. Two byte-identical legacy records still collapse, which is a dedup,
	not a loss."""
	return bool(
		frappe.db.exists(
			"Saved View",
			{
				"reference_doctype": legacy.dt,
				"user": user or UNSET,
				"label": legacy.label or "View",
				"is_default": is_default,
				"filters": filters,
			},
		)
	)


def parse_json(value):
	if not value:
		return None
	if isinstance(value, dict | list):
		return value
	try:
		return json.loads(value)
	except (ValueError, TypeError):
		return None

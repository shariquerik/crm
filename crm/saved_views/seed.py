# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Seed the Deals and Leads sidebars with their shared Views and Pipeline sections.

Runs on install and, for existing sites, from the saved-views patch. Idempotent by
gating on the section: once a shared group exists it is left untouched, so re-running
never duplicates a view and never resurrects one a manager deleted from it. Pipeline
views are ordinary static views once seeded — a later status change does not touch
them.
"""

import json

import frappe

# A view whose status type is one of these is closed; every other type is "open".
CLOSED_STATUS_TYPES = ("Won", "Lost")


def seed_saved_views():
	seed_doctype("CRM Deal", "CRM Deal Status", "deal_owner", closing_field="expected_closure_date")
	seed_doctype("CRM Lead", "CRM Lead Status", "lead_owner")


def seed_doctype(doctype, status_doctype, owner_field, closing_field=None):
	seed_group(doctype, "Views", views_section(status_doctype, owner_field, closing_field))
	seed_group(doctype, "Pipeline", pipeline_section(status_doctype))


def views_section(status_doctype, owner_field, closing_field):
	open_statuses = open_status_names(status_doctype)
	section = [
		view_def("All", [], icon="list"),
		view_def("Open", [["status", "in", open_statuses]], icon="circle-dot"),
		view_def("My open", [["status", "in", open_statuses], [owner_field, "=", "@me"]], icon="user"),
	]
	if closing_field:
		section.append(
			view_def(
				"Closing this month",
				[[closing_field, "timespan", "this month"]],
				icon="calendar-clock",
			)
		)
	section.append(view_def("Unassigned", [[owner_field, "is", "not set"]], icon="user-x"))
	return section


def pipeline_section(status_doctype):
	"""One view per status, in board order, coloured with the status. The colour rides
	on `icon`, the only per-view marker a Saved View carries; the CRM sidebar renders
	it as a dot."""
	statuses = frappe.get_all(status_doctype, fields=["name", "color"], order_by="position asc")
	return [view_def(status.name, [["status", "=", status.name]], icon=status.color) for status in statuses]


def view_def(label, filters, icon=None):
	return {"label": label, "icon": icon, "filters": filters}


def open_status_names(status_doctype):
	return frappe.get_all(
		status_doctype,
		filters={"type": ("not in", CLOSED_STATUS_TYPES)},
		pluck="name",
		order_by="position asc",
	)


def seed_group(doctype, label, view_defs):
	if shared_group_exists(doctype, label):
		return
	views = [create_shared_view(doctype, defn) for defn in view_defs]
	create_shared_group(doctype, label, views)


def shared_group_exists(doctype, label):
	return bool(
		frappe.db.exists(
			"Saved View Group",
			{
				"reference_doctype": doctype,
				"label": label,
				"user": ("in", ("", None)),
				"overrides": ("in", ("", None)),
			},
		)
	)


def create_shared_view(doctype, defn):
	return frappe.get_doc(
		{
			"doctype": "Saved View",
			"label": defn["label"],
			"icon": defn.get("icon"),
			"reference_doctype": doctype,
			"type": "list",
			"user": "",
			"filters": json.dumps(defn["filters"]),
		}
	).insert(ignore_permissions=True)


def create_shared_group(doctype, label, views):
	frappe.get_doc(
		{
			"doctype": "Saved View Group",
			"label": label,
			"reference_doctype": doctype,
			"user": "",
			"sequence": next_shared_sequence(doctype),
			"views": [{"view": view.name} for view in views],
		}
	).insert(ignore_permissions=True)


def next_shared_sequence(doctype):
	highest = frappe.db.get_value(
		"Saved View Group",
		{"reference_doctype": doctype, "user": ("in", ("", None))},
		"sequence",
		order_by="sequence desc",
	)
	return (highest or 0) + 1

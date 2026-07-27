# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Seed each CRM doctype's sidebar with its shared Views and Pipeline sections.

Deals and Leads carry a full Views section and a Pipeline coloured from their status
doctype; Tasks get a Pipeline off a Select field instead; Contacts, Organizations, and
Notes get a Views section alone. Runs on install and, for existing sites, from the
saved-views patches. Idempotent by gating on the section: once a shared section exists it is left
untouched, so re-running never duplicates a view and never resurrects one a manager
deleted from it. Pipeline views are ordinary static views once seeded — a later status
change does not touch them.
"""

import json

import frappe
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope

from crm.saved_views.scope import CRM_APP

# A view whose status type is one of these is closed; every other type is "open".
CLOSED_STATUS_TYPES = ("Won", "Lost")

# Palette tokens a status carries, each seeded as a filled-dot Custom Icon (see
# `status_dot`). Cycled through a Select field's options in order, since a Select —
# unlike a status *doctype* — carries no colour of its own.
SELECT_PALETTE = ("gray", "blue", "amber", "green", "red", "purple", "cyan", "orange")

# The espresso 500 hex for each palette token, baked into the dot svg. Not
# `currentColor`: ViewIcon draws a custom icon in ink-gray, which would grey the dot
# out. Kept in sync with frappe-ui's colour palette. Wider than SELECT_PALETTE: a
# status *doctype*'s `color` can be any of these, while a Select only cycles the eight.
DOT_HEX = {
	"gray": "#999999",
	"blue": "#0289f7",
	"amber": "#e79913",
	"green": "#59ba8b",
	"red": "#e03636",
	"pink": "#e34aa6",
	"orange": "#e86c13",
	"yellow": "#edba13",
	"cyan": "#3bbde5",
	"teal": "#36baad",
	"violet": "#6846e3",
	"purple": "#9c45e3",
	"black": "#171717",
}

# Where an option's name suggests a colour, use it so a pipeline reads right at a
# glance; the palette fills in the rest by position.
STATUS_COLORS = {
	"backlog": "gray",
	"todo": "blue",
	"in progress": "amber",
	"done": "green",
	"canceled": "red",
	"cancelled": "red",
	"passive": "gray",
	"open": "blue",
	"replied": "green",
}


def seed_saved_views():
	seed_deal_and_lead()
	seed_contact()
	seed_organization()
	seed_task()
	seed_note()


def seed_deal_and_lead():
	seed_status_doctype("CRM Deal", "CRM Deal Status", "deal_owner", closing_field="expected_closure_date")
	seed_status_doctype("CRM Lead", "CRM Lead Status", "lead_owner")


def seed_status_doctype(doctype, status_doctype, owner_field, closing_field=None):
	seed_section(doctype, "Views", views_section(status_doctype, owner_field, closing_field))
	seed_section(doctype, "Pipeline", pipeline_section(status_doctype))


def seed_contact():
	# A contact's organisation rides on `company_name` (a Data field CRM populates), so
	# "No organization" reads off it, not a link.
	seed_section(
		"Contact",
		"Views",
		[
			view_def("All", [], icon="list"),
			view_def("My contacts", [["owner", "=", "@me"]], icon="user"),
			view_def("Recently added", [], icon="clock", order_by="creation desc"),
			view_def("No organization", [["company_name", "is", "not set"]], icon="building"),
		],
	)


def seed_organization():
	seed_section(
		"CRM Organization",
		"Views",
		[
			view_def("All", [], icon="list"),
			view_def("My organizations", [["owner", "=", "@me"]], icon="user"),
		],
	)


def seed_task():
	# Tasks are assigned rather than owned, and closed once Done or Cancelled — so "open"
	# and "mine" read off different fields than the status-doctype doctypes above.
	open_task = ["status", "not in", ["Done", "Canceled"]]
	seed_section(
		"CRM Task",
		"Views",
		[
			view_def("All", [], icon="list"),
			view_def("My tasks", [["assigned_to", "=", "@me"]], icon="user"),
			view_def("Open", [open_task], icon="circle-dot"),
			view_def("Overdue", [["due_date", "<", "now"], open_task], icon="calendar-clock"),
		],
	)
	seed_section("CRM Task", "Pipeline", select_pipeline_section("CRM Task", "status"))


def seed_note():
	seed_section(
		"FCRM Note",
		"Views",
		[
			view_def("All", [], icon="list"),
			view_def("My notes", [["owner", "=", "@me"]], icon="user"),
		],
	)


def seed_all_view(doctype):
	"""The sidebar a doctype gets when it is put on the rail by hand: the same shared
	"Views" section the doctypes above open with, holding an All and nothing more —
	what else is worth filtering for is that doctype's business, not ours. Without it
	the sidebar falls back to a virtual All pointing at the plain list route, which
	names no view and so leaves the breadcrumb reading only the doctype."""
	seed_section(doctype, "Views", [view_def("All", [], icon="list")])


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
	on `icon`, the only per-view marker a Saved View carries; it names a dot Custom Icon
	the CRM sidebar renders inline (see `status_dot`)."""
	statuses = frappe.get_all(status_doctype, fields=["name", "color"], order_by="position asc")
	return [
		view_def(status.name, [["status", "=", status.name]], icon=status_dot(status.color))
		for status in statuses
	]


def select_pipeline_section(doctype, fieldname):
	"""One view per option of a Select field, coloured from the palette. The
	status-doctype path above rides colour on the linked status; a Select has none, so
	the dot comes from the option's name where we know it and its position otherwise."""
	options = select_options(doctype, fieldname)
	return [
		view_def(option, [[fieldname, "=", option]], icon=status_dot(color_for(option, index)))
		for index, option in enumerate(options)
	]


def status_dot(color):
	"""The `custom:<name>` icon for a status colour, seeding the dot Custom Icon on
	first use. A view's dot is thus an ordinary custom icon — aligned like every other
	and re-pickable from the icon picker — rather than a bespoke render branch. An
	unknown token falls through unchanged, as it did when it rode straight on `icon`."""
	color_hex = DOT_HEX.get(color)
	if not color_hex:
		return color
	name = f"dot-{color}"
	if not frappe.db.exists("Custom Icon", name):
		frappe.get_doc({"doctype": "Custom Icon", "icon_name": name, "svg": dot_svg(color_hex)}).insert(
			ignore_permissions=True
		)
	return f"custom:{name}"


def dot_svg(color_hex):
	# An 8px dot centred in the 16px icon box, so it reads like the old marker while
	# aligning with the Lucide icons beside it.
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
		f'<circle cx="8" cy="8" r="4" fill="{color_hex}"/></svg>'
	)


def select_options(doctype, fieldname):
	field = frappe.get_meta(doctype).get_field(fieldname)
	return [option.strip() for option in (field.options or "").split("\n") if option.strip()]


def color_for(option, index):
	return STATUS_COLORS.get(option.lower()) or SELECT_PALETTE[index % len(SELECT_PALETTE)]


def view_def(label, filters, icon=None, order_by=None):
	return {"label": label, "icon": icon, "filters": filters, "order_by": order_by}


def open_status_names(status_doctype):
	return frappe.get_all(
		status_doctype,
		filters={"type": ("not in", CLOSED_STATUS_TYPES)},
		pluck="name",
		order_by="position asc",
	)


def seed_section(doctype, label, view_defs):
	if shared_section_exists(doctype, label):
		return
	views = [create_shared_view(doctype, defn) for defn in view_defs]
	create_shared_section(doctype, label, views)


def shared_section_exists(doctype, label):
	return bool(
		frappe.db.exists(
			"Navigation Section",
			{
				**Scope(CRM_APP, doctype).filters(),
				"label": label,
				"user": UNSET,
				"overrides": UNSET,
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
			"order_by": defn.get("order_by"),
		}
	).insert(ignore_permissions=True)


def create_shared_section(doctype, label, views):
	frappe.get_doc(
		{
			"doctype": "Navigation Section",
			"label": label,
			**Scope(CRM_APP, doctype).as_fields(),
			"user": "",
			"sequence": next_shared_sequence(doctype),
			"items": [{"type": "view", "view": view.name} for view in views],
		}
	).insert(ignore_permissions=True)


def next_shared_sequence(doctype):
	highest = frappe.db.get_value(
		"Navigation Section",
		{**Scope(CRM_APP, doctype).filters(), "user": UNSET},
		"sequence",
		order_by="sequence desc",
	)
	return (highest or 0) + 1

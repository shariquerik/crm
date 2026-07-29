# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""The `page` navigation item type, which CRM adds to the three the framework ships."""

import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

PAGE = "page"

STUDIO_APP = "crm-studio"


def page_targets(names: list[str]) -> dict[str, str]:
	"""Where each `page` row among `names` leads, keyed by row name — the shape the
	`navigation_item_targets` hook answers in.
	"""
	rows = frappe.get_all(
		"Navigation Item",
		filters={"name": ("in", names), "type": PAGE},
		fields=["name", "page"],
	)
	routes = reachable_routes({row.page for row in rows if row.page})
	return {row.name: routes[row.page] for row in rows if row.page in routes}


def reachable_routes(pages: set[str]) -> dict[str, str]:
	if not pages:
		return {}

	reachable = frappe.get_all(
		"Studio Page",
		filters={"name": ("in", list(pages)), "published": 1, "studio_app": STUDIO_APP},
		fields=["name", "route"],
	)
	return {page.name: page.route for page in reachable if page.route}


def validate_page_items(doc, method=None):
	"""What a page item cannot do without, checked from the section: the framework
	requires nothing of a type it does not know, and runs no hooks on child rows.
	"""
	for item in doc.items:
		if not item.overrides and item.type == PAGE:
			validate_page_item(item)


def validate_page_item(item):
	missing = [field for field in ("label", PAGE) if not item.get(field)]
	if missing:
		frappe.throw(
			_("A page item needs {0}.").format(", ".join(missing)),
			frappe.MandatoryError,
		)
	validate_openable(item.get(PAGE))


def validate_openable(page: str):
	"""A page has to have one fixed address in this app for an item to lead there."""
	studio_page = frappe.db.get_value("Studio Page", page, ["route", "studio_app"], as_dict=True)
	if not studio_page:
		return

	if studio_page.studio_app != STUDIO_APP:
		frappe.throw(_("{0} belongs to another app.").format(page), frappe.ValidationError)
	if ":" in (studio_page.route or ""):
		frappe.throw(_("{0} has no single address to open at.").format(page), frappe.ValidationError)


def install_page_item_type(app_name: str | None = None):
	"""The custom field and the property setter that make `page` a type items can hold."""
	if app_name and app_name != "studio":
		return
	if "studio" not in frappe.get_installed_apps():
		return

	add_page_field()
	add_page_to_type_options()
	frappe.clear_cache(doctype="Navigation Item")


def add_page_field():
	if frappe.get_meta("Navigation Item").has_field(PAGE):
		return

	create_custom_fields(
		{
			"Navigation Item": [
				{
					"fieldname": PAGE,
					"fieldtype": "Link",
					"label": "Studio Page",
					"options": "Studio Page",
					"link_filters": frappe.as_json([["Studio Page", "studio_app", "=", STUDIO_APP]]),
					"description": "The page a page item opens, whose route is resolved on read rather than stored.",
					"insert_after": "dt",
				}
			]
		}
	)


def add_page_to_type_options():
	"""Appended to whatever the framework currently ships rather than restated, so a
	fourth framework type does not silently disappear behind this setter."""
	options = frappe.get_meta("Navigation Item").get_field("type").options.split("\n")
	if PAGE in options:
		return

	make_property_setter(
		"Navigation Item",
		"type",
		"options",
		"\n".join([*options, PAGE]),
		"Text",
		validate_fields_for_doctype=False,
	)

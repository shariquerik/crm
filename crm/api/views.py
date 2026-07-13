import json

import frappe
from frappe.query_builder import Order
from pypika import Criterion

# ---------------------------------------------------------------------------
# get_doctype_list, get_current_view, STANDARD_LIST_FIELDS, ordered_fieldnames
# and add_standard_view below are copied from PR frappe/crm#1524
# ("feat: Doctypes in sidebar"), commit 51eb481c57b016c4d275e583d2bd0bc8e3bb6abb.
# get_views' signature change (doctype is now optional) comes from the same PR.
#
# Per docs/adr/0002 the PR's backend is copied once, not merged: upstream drift
# must be re-copied by hand.
#
# Local adaptation: this app sets `require_type_annotated_api_methods = True`
# (hooks.py), which the PR's base branch did not. The whitelisted functions
# below therefore carry type annotations their PR originals lack — without them
# Frappe rejects the call at dispatch. Bodies are otherwise unchanged.
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_doctype_list():
	doctypes = (
		frappe.qb.from_("DocType")
		.select("name")
		.where(Criterion.all([frappe.qb.Field("issingle") == 0, frappe.qb.Field("istable") == 0]))
		.orderby("name")
		.run(as_dict=True)
	)
	return doctypes


@frappe.whitelist()
def get_views(doctype: str | None = None):
	View = frappe.qb.DocType("CRM View Settings")
	query = (
		frappe.qb.from_(View)
		.select("*")
		.where(Criterion.any([View.user == "", View.user == frappe.session.user]))
	)
	if doctype:
		query = query.where(View.dt == doctype)
	views = query.run(as_dict=True)
	return views


@frappe.whitelist()
def get_current_view(doctype: str | None = None, view_name: str | int | None = None):
	View = frappe.qb.DocType("CRM View Settings")
	# Deliberate divergence from PR 1524: it selects a view by name with no user scoping,
	# so any logged-in user could read someone else's private view — and its filters — by
	# walking the autoincrement ids. Scope every branch to what the user may see, which is
	# the same predicate get_views() already applies (public views have user == "").
	query = (
		frappe.qb.from_(View)
		.select("*")
		.where(Criterion.any([View.user == "", View.user == frappe.session.user]))
	)

	if view_name:
		query = query.where(View.name == view_name)
	else:
		query = (
			query.where(View.is_standard == 1)
			.where(View.dt == doctype)
			.orderby("modified", order=Order.desc)
			.limit(1)
		)

	view = query.run(as_dict=True) or None

	if not view:
		# A view_name that names nothing the user may see (deleted, or someone else's
		# private view) leaves us with no doctype to synthesize a standard view from —
		# PR 1524 called add_standard_view(None) here and died with "DocType None not
		# found". Say "no view" instead of raising a 500.
		if not doctype:
			return None
		return add_standard_view(doctype)

	return view[0]


STANDARD_LIST_FIELDS = {
	"name": {"label": "Name", "fieldtype": "Data", "fieldname": "name", "width": "16rem"},
	"modified": {
		"label": "Last Updated On",
		"fieldtype": "Datetime",
		"fieldname": "modified",
		"width": "8rem",
	},
}


def ordered_fieldnames(title_field, fields):
	seen = set()
	ordered = []

	_fields = [f.get("fieldname") for f in fields if f.get("in_list_view")]

	def add_field(fieldname):
		if not fieldname or fieldname in seen:
			return
		seen.add(fieldname)
		ordered.append(fieldname)

	base_fields = [f for f in _fields if f not in {"name", "modified", title_field}]

	if title_field:
		add_field(title_field)
		for fieldname in base_fields:
			add_field(fieldname)
		add_field("name")
	else:
		add_field("name")
		for fieldname in base_fields:
			add_field(fieldname)

	add_field("modified")

	return ordered


def add_standard_view(doctype):
	columns = [{"label": "Like", "type": "Data", "key": "_liked_by", "width": "50px"}]
	rows = ["name"]

	meta = frappe.get_meta(doctype)
	fields = meta.get("fields") or []
	title_field = (meta.get("title_field") or "").strip() or None
	ordered_fields = ordered_fieldnames(title_field, fields)
	field_map = {f.get("fieldname"): f for f in fields if f.get("fieldname")}

	# Deliberate divergence from PR 1524, which narrows the module-level
	# STANDARD_LIST_FIELDS["name"] in place. That dict outlives the request, so in a
	# long-lived worker the first doctype WITH a title field permanently narrows the
	# name column for every doctype rendered afterwards. Copy per call instead.
	standard_fields = {fieldname: dict(field) for fieldname, field in STANDARD_LIST_FIELDS.items()}
	if title_field:
		standard_fields["name"]["width"] = "8rem"

	for fieldname in ordered_fields:
		field_def = standard_fields.get(fieldname) or field_map.get(fieldname)
		if not field_def:
			continue
		columns.append(
			{
				"label": field_def.get("label"),
				"type": field_def.get("fieldtype"),
				"key": field_def.get("fieldname"),
				"width": field_def.get("width") or "10rem",
			}
		)
		field_key = field_def.get("fieldname")
		if field_key and field_key not in rows:
			rows.append(field_key)

	standard_view = {
		"name": f"Standard view ({doctype})",
		"label": "List",
		"type": "list",
		"dt": doctype,
		"columns": json.dumps(columns),
		"rows": json.dumps(rows),
		"filters": json.dumps({}),
		"order_by": "modified desc",
		"is_standard": 1,
	}

	return standard_view

"""CRM's field layouts — `crm_fields_layout.get_fields_layout`, shaped for FormLayout.

Two screens render a form out of the same API: the detail page's fields panel ("Data
Fields") and the list page's Create dialog ("Quick Entry"). Both hand the result to
@framework/ui's FormLayout, which speaks FormLayoutSchema — a tab -> section -> column ->
FieldMeta tree. get_fields_layout already returns that tree; only its leaves are raw
Frappe docfields (snake_case, 0/1), so one `transform` maps them to FieldMeta (camelCase,
booleans). It lives here rather than in either page, because both need exactly it.

When a doctype has no `CRM Fields Layout` row, get_fields_layout synthesizes one from the
doctype's meta — which is why the generic pages work for Contact and Organization too,
not just the doctypes CRM ships layouts for.
"""

import json

# The layout types CRM defines (Quick Entry | Side Panel | Data Fields | Grid Row |
# Required Fields). Only these two are used here:
#
#   DATA_FIELDS — the detail screen's fields panel: multi-column, expanded, and the only
#     type that is purely fields (Side Panel mixes in CRM's contacts/lost-reason widgets
#     and leaves unresolvable fieldnames as bare strings).
#   QUICK_ENTRY — the short "new record" form CRM shows in its own create modal.
DATA_FIELDS = "Data Fields"
QUICK_ENTRY = "Quick Entry"

# Frappe docfield (snake_case, 0/1) -> FieldMeta (camelCase, booleans), keeping CRM's
# tab/section/column tree as-is. Runs as the layout resource's `transform`.
TRANSFORM = """
function transform(tabs) {
	const LAYOUT_BREAKS = ["Tab Break", "Section Break", "Column Break"]
	// get_fields_layout carries no child-table meta, so a grid would render column-less.
	// Child tables are out of scope for v1's form.
	const CHILD_TABLES = ["Table", "Table MultiSelect"]

	function toFieldMeta(field) {
		return {
			fieldname: field.fieldname,
			fieldtype: field.fieldtype,
			label: field.label,
			// Select options are a newline-joined string in meta; CRM hands some layouts
			// back as [{label, value}] instead.
			options: Array.isArray(field.options)
				? field.options.map((option) => (option && option.value !== undefined ? option.value : option)).join("\\n")
				: field.options,
			reqd: Boolean(field.reqd),
			hidden: Boolean(field.hidden),
			readOnly: Boolean(field.read_only) || field.fieldtype === "Read Only",
			precision: field.precision ? Number(field.precision) : undefined,
			description: field.description || undefined,
			placeholder: field.placeholder || undefined,
			dependsOn: field.depends_on || undefined,
			mandatoryDependsOn: field.mandatory_depends_on || undefined,
			readOnlyDependsOn: field.read_only_depends_on || undefined,
		}
	}

	return (tabs || []).map(function (tab) {
		return {
			name: tab.name,
			label: tab.label,
			sections: (tab.sections || []).map(function (section) {
				return {
					name: section.name,
					label: section.label,
					hideLabel: Boolean(section.hideLabel),
					hideBorder: Boolean(section.hideBorder),
					collapsible: Boolean(section.collapsible),
					opened: section.opened !== false,
					columns: (section.columns || []).map(function (column) {
						return {
							name: column.name,
							fields: (column.fields || [])
								// a fieldname the doctype no longer has stays an unexpanded string
								.filter((field) => field && typeof field === "object")
								.filter((field) => !LAYOUT_BREAKS.includes(field.fieldtype) && !CHILD_TABLES.includes(field.fieldtype))
								.map(toFieldMeta),
						}
					}),
				}
			}),
		}
	})
}
""".strip()


def resource(resource_name: str, layout_type: str, doctype_expr: str = "{{ route.params.doctype }}") -> dict:
	"""The layout as a page resource. `auto` is 0 on both pages: the layout is for the
	route's doctype, so it may not fire until the guard has confirmed the route names one
	(the list page defers it further — see pages/list.py's openCreate)."""
	return {
		"resource_name": resource_name,
		"resource_type": "API Resource",
		"url": "crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout",
		"method": "GET",
		"auto": 0,
		# Params are evaluated ONCE, at resource creation, against {variables, route,
		# router} — which is all this needs: the route carries the doctype name itself.
		"params": json.dumps({"doctype": doctype_expr, "type": layout_type}),
		"transform": TRANSFORM,
	}

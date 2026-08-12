import frappe

TYPE_MAP = {"Data Fields": "Details", "Side Panel": "Side Panel", "Quick Entry": "Quick Entry"}


def execute():
	rows = frappe.get_all(
		"CRM Fields Layout",
		filters={"type": ("in", list(TYPE_MAP))},
		fields=["dt", "type", "layout"],
	)
	for row in rows:
		if not row.dt or has_default_form_layout(row.dt, TYPE_MAP[row.type]):
			continue
		frappe.get_doc(
			{"doctype": "Form Layout", "dt": row.dt, "type": TYPE_MAP[row.type], "layout": row.layout}
		).insert(ignore_permissions=True)


def has_default_form_layout(dt: str, type: str) -> bool:
	filters = {"dt": dt, "type": type, "condition": ("is", "not set")}
	return bool(frappe.get_all("Form Layout", filters=filters, limit=1))

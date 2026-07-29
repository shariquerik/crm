import frappe

from crm.saved_views.seed import DOT_HEX, status_dot


def execute():
	"""Repoint existing Pipeline dots from bare palette tokens to Custom Icons, so a
	view's dot is a first-class, re-pickable icon now that ViewIcon has dropped its
	DOT_CLASS render branch. Only bare palette tokens are touched — the Views sections
	carry Lucide names — and `status_dot` seeds each dot Custom Icon as it goes.
	Idempotent: a rewritten icon is a `custom:` name, no longer in `DOT_HEX`."""
	for name in frappe.get_all("Saved View", filters={"icon": ("in", list(DOT_HEX))}, pluck="name"):
		token = frappe.db.get_value("Saved View", name, "icon")
		frappe.db.set_value("Saved View", name, "icon", status_dot(token))

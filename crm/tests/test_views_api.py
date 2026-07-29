# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt


import json

import frappe
from frappe.tests import IntegrationTestCase

from crm.api.views import add_standard_view, get_current_view, get_doctype_list, get_views
from crm.fcrm.doctype.crm_view_settings.crm_view_settings import create_or_update_view, get_route_name


class IntegrationTestViewsAPI(IntegrationTestCase):
	def tearDown(self):
		frappe.db.rollback()

	def _make_view(self, label, doctype="CRM Lead", is_standard=0):
		return create_or_update_view(
			{
				"label": label,
				"doctype": doctype,
				"type": "list",
				"is_standard": is_standard,
				"filters": json.dumps({"status": "Open"}),
				"order_by": "modified desc",
				"columns": json.dumps([{"label": "Name", "type": "Data", "key": "name", "width": "16rem"}]),
				"rows": json.dumps(["name", "status"]),
			}
		)

	def test_get_views_works_without_a_doctype(self):
		self._make_view("Open Leads")
		self.assertIsInstance(get_views(), list)

	def test_get_views_filters_by_doctype(self):
		self._make_view("Open Leads", doctype="CRM Lead")
		labels = [v.get("label") for v in get_views("CRM Lead")]
		self.assertIn("Open Leads", labels)

		deal_labels = [v.get("label") for v in get_views("CRM Deal")]
		self.assertNotIn("Open Leads", deal_labels)

	def test_get_doctype_list_excludes_single_and_child_doctypes(self):
		names = {d["name"] for d in get_doctype_list()}
		self.assertIn("CRM Lead", names)
		self.assertNotIn("FCRM Settings", names)

	def test_get_current_view_returns_the_named_view(self):
		view = self._make_view("Open Leads")
		current = get_current_view(view_name=view.name)
		self.assertEqual(current["label"], "Open Leads")

	def test_get_current_view_hides_another_users_private_view(self):
		view = self._make_view("Someone Elses Leads")
		frappe.db.set_value("CRM View Settings", view.name, "user", "someone.else@example.com")

		leaked = get_current_view(view_name=view.name)

		self.assertIsNone(leaked)

	def test_get_current_view_falls_back_to_a_standard_view_when_the_name_is_unknown(self):
		view = get_current_view(doctype="CRM Lead", view_name=-1)
		self.assertEqual(view["dt"], "CRM Lead")
		self.assertEqual(view["is_standard"], 1)

	def test_get_current_view_still_returns_a_public_view(self):
		view = self._make_view("Everyones Leads")
		frappe.db.set_value("CRM View Settings", view.name, "user", "")

		current = get_current_view(view_name=view.name)
		self.assertEqual(current["label"], "Everyones Leads")

	def test_get_current_view_synthesizes_a_standard_view_when_none_exists(self):
		frappe.db.delete("CRM View Settings", {"dt": "CRM Task"})
		view = get_current_view(doctype="CRM Task")

		self.assertEqual(view["dt"], "CRM Task")
		self.assertEqual(view["is_standard"], 1)
		self.assertEqual(view["order_by"], "modified desc")
		rows = json.loads(view["rows"])
		self.assertIn("name", rows)
		keys = [c["key"] for c in json.loads(view["columns"])]
		self.assertEqual(keys[0], "_liked_by")
		self.assertIn("modified", keys)

	def test_add_standard_view_does_not_leak_column_width_between_doctypes(self):
		titled = next(
			(d for d in ("CRM Lead", "CRM Deal", "Contact") if frappe.get_meta(d).title_field), None
		)
		untitled = next(
			(d for d in ("CRM Task", "FCRM Note", "CRM Lead") if not frappe.get_meta(d).title_field),
			None,
		)
		if not titled or not untitled:
			self.skipTest("need one titled and one untitled doctype")

		def name_width(doctype):
			columns = json.loads(add_standard_view(doctype)["columns"])
			return next(c["width"] for c in columns if c["key"] == "name")

		before = name_width(untitled)
		name_width(titled)  # would poison the shared dict
		self.assertEqual(name_width(untitled), before)

	def test_add_standard_view_puts_the_title_field_first(self):
		view = add_standard_view("CRM Lead")
		keys = [c["key"] for c in json.loads(view["columns"])]
		title_field = frappe.get_meta("CRM Lead").title_field

		self.assertEqual(keys[0], "_liked_by")
		if title_field:
			self.assertEqual(keys[1], title_field)
		self.assertEqual(keys[-1], "modified")

	def test_create_or_update_view_creates_then_updates(self):
		view = self._make_view("Open Leads")
		self.assertEqual(view.label, "Open Leads")
		self.assertEqual(view.dt, "CRM Lead")
		self.assertEqual(json.loads(view.filters), {"status": "Open"})

		updated = create_or_update_view(
			{
				"name": view.name,
				"label": "Renamed Leads",
				"doctype": "CRM Lead",
				"type": "list",
				"filters": json.dumps({"status": "Won"}),
				"order_by": "creation asc",
				"columns": view.columns,
				"rows": view.rows,
			}
		)

		self.assertEqual(updated.name, view.name)
		self.assertEqual(updated.label, "Renamed Leads")
		self.assertEqual(json.loads(updated.filters), {"status": "Won"})
		self.assertEqual(updated.order_by, "creation asc")

	def test_create_or_update_view_routes_standard_views_to_the_standard_upsert(self):
		first = self._make_view("List", is_standard=1)
		second = self._make_view("List", is_standard=1)
		self.assertEqual(first.name, second.name)
		self.assertTrue(second.is_standard)

	def test_get_route_name_reads_the_view(self):
		self.assertEqual(
			get_route_name(frappe._dict({"doctype": "CRM Lead", "is_standard": 1})), "CRM Lead List"
		)
		self.assertEqual(
			get_route_name(frappe._dict({"doctype": "CRM Lead", "is_standard": 0})),
			"CRM Lead List View",
		)

	def test_remove_duplicates_drops_nones(self):
		from crm.fcrm.doctype.crm_view_settings.crm_view_settings import remove_duplicates

		self.assertEqual(remove_duplicates(["name", None, "status", "name"]), ["name", "status"])

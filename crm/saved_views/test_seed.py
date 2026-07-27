# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import json

import frappe
from frappe.desk.doctype.navigation_section.navigation_section import get_sidebar
from frappe.tests import IntegrationTestCase

from crm.saved_views.scope import CRM_APP
from crm.saved_views.seed import seed_saved_views


def clear_saved_views(*doctypes):
	for doctype in doctypes:
		for section in frappe.get_all("Navigation Section", {"reference_doctype": doctype}, pluck="name"):
			frappe.delete_doc("Navigation Section", section, force=True, ignore_permissions=True)
		for view in frappe.get_all("Saved View", {"reference_doctype": doctype}, pluck="name"):
			frappe.delete_doc("Saved View", view, force=True, ignore_permissions=True)


def shared_section(doctype, label):
	name = frappe.db.get_value(
		"Navigation Section",
		{"app": CRM_APP, "reference_doctype": doctype, "label": label, "user": ("in", ("", None))},
		"name",
	)
	return frappe.get_doc("Navigation Section", name) if name else None


def view_labels(section):
	return [frappe.db.get_value("Saved View", row.view, "label") for row in section.items]


def view_by_label(section, label):
	for row in section.items:
		view = frappe.get_doc("Saved View", row.view)
		if view.label == label:
			return view
	return None


class TestSeed(IntegrationTestCase):
	def setUp(self):
		clear_saved_views("CRM Deal", "CRM Lead", "Contact", "CRM Organization", "CRM Task", "FCRM Note")
		seed_saved_views()

	def tearDown(self):
		frappe.db.rollback()

	def test_deals_views_section(self):
		section = shared_section("CRM Deal", "Views")
		self.assertEqual(view_labels(section), ["All", "Open", "My open", "Closing this month", "Unassigned"])

	def test_leads_views_section_has_no_closing_view(self):
		section = shared_section("CRM Lead", "Views")
		self.assertEqual(view_labels(section), ["All", "Open", "My open", "Unassigned"])

	def test_all_carries_no_filter(self):
		view = view_by_label(shared_section("CRM Deal", "Views"), "All")
		self.assertEqual(json.loads(view.filters), [])

	def test_open_filters_on_the_open_statuses(self):
		open_statuses = frappe.get_all(
			"CRM Deal Status", {"type": ("not in", ("Won", "Lost"))}, pluck="name", order_by="position asc"
		)
		view = view_by_label(shared_section("CRM Deal", "Views"), "Open")
		self.assertEqual(json.loads(view.filters), [["status", "in", open_statuses]])

	def test_my_open_filters_on_the_current_user(self):
		view = view_by_label(shared_section("CRM Deal", "Views"), "My open")
		self.assertIn(["deal_owner", "=", "@me"], json.loads(view.filters))

	def test_unassigned_filters_on_owner_not_set(self):
		view = view_by_label(shared_section("CRM Lead", "Views"), "Unassigned")
		self.assertEqual(json.loads(view.filters), [["lead_owner", "is", "not set"]])

	def test_views_carry_lucide_icons(self):
		section = shared_section("CRM Deal", "Views")
		self.assertEqual(view_by_label(section, "All").icon, "list")
		self.assertEqual(view_by_label(section, "Unassigned").icon, "user-x")

	def test_pipeline_has_a_coloured_view_per_deal_status(self):
		statuses = frappe.get_all("CRM Deal Status", fields=["name", "color"], order_by="position asc")
		section = shared_section("CRM Deal", "Pipeline")

		self.assertEqual(view_labels(section), [status.name for status in statuses])
		for row, status in zip(section.items, statuses, strict=True):
			view = frappe.get_doc("Saved View", row.view)
			# The colour rides on a dot Custom Icon, seeded on demand, not a bare token.
			self.assertEqual(view.icon, f"custom:dot-{status.color}")
			self.assertTrue(frappe.db.exists("Custom Icon", f"dot-{status.color}"))
			self.assertEqual(json.loads(view.filters), [["status", "=", status.name]])
			self.assertEqual(view.user, "")

	def test_contact_gets_views_and_no_pipeline(self):
		section = shared_section("Contact", "Views")
		self.assertEqual(view_labels(section), ["All", "My contacts", "Recently added", "No organization"])
		self.assertIsNone(shared_section("Contact", "Pipeline"))

	def test_recently_added_sorts_by_creation_instead_of_filtering(self):
		view = view_by_label(shared_section("Contact", "Views"), "Recently added")
		self.assertEqual(json.loads(view.filters), [])
		self.assertEqual(view.order_by, "creation desc")

	def test_no_organization_filters_on_the_company_name_field(self):
		view = view_by_label(shared_section("Contact", "Views"), "No organization")
		self.assertEqual(json.loads(view.filters), [["company_name", "is", "not set"]])

	def test_select_pipeline_colours_options_from_the_palette(self):
		section = shared_section("CRM Task", "Pipeline")
		self.assertEqual(view_by_label(section, "Done").icon, "custom:dot-green")
		self.assertEqual(view_by_label(section, "Canceled").icon, "custom:dot-red")

	def test_organization_and_note_get_an_all_and_a_mine_view_only(self):
		self.assertEqual(
			view_labels(shared_section("CRM Organization", "Views")), ["All", "My organizations"]
		)
		self.assertEqual(view_labels(shared_section("FCRM Note", "Views")), ["All", "My notes"])
		self.assertIsNone(shared_section("CRM Organization", "Pipeline"))

	def test_tasks_open_and_overdue_read_off_the_task_fields(self):
		section = shared_section("CRM Task", "Views")
		self.assertEqual(view_labels(section), ["All", "My tasks", "Open", "Overdue"])
		self.assertIn(["assigned_to", "=", "@me"], json.loads(view_by_label(section, "My tasks").filters))
		self.assertEqual(
			json.loads(view_by_label(section, "Open").filters),
			[["status", "not in", ["Done", "Canceled"]]],
		)

	def test_a_seeded_section_belongs_to_the_crm_app(self):
		self.assertEqual(shared_section("CRM Deal", "Views").app, CRM_APP)

	def test_a_seeded_section_reaches_the_crm_sidebar(self):
		"""The read is filtered by app, so seeding under another name would leave the
		sidebar empty."""
		sidebar = get_sidebar("CRM Deal", app=CRM_APP)["sections"]

		self.assertIn("Views", [section["label"] for section in sidebar])

	def test_views_section_sits_before_pipeline(self):
		self.assertLess(
			shared_section("CRM Deal", "Views").sequence, shared_section("CRM Deal", "Pipeline").sequence
		)

	def test_rerun_creates_no_duplicate_sections_or_views(self):
		seed_saved_views()

		sections = frappe.get_all(
			"Navigation Section",
			{"reference_doctype": "CRM Deal", "label": "Views", "user": ("in", ("", None))},
		)
		self.assertEqual(len(sections), 1)
		self.assertEqual(len(shared_section("CRM Deal", "Views").items), 5)

	def test_rerun_does_not_restore_a_manager_deleted_view(self):
		section = shared_section("CRM Deal", "Views")
		removed = view_by_label(section, "Open").name
		section.items = [row for row in section.items if str(row.view) != str(removed)]
		section.save(ignore_permissions=True)
		frappe.delete_doc("Saved View", removed, force=True, ignore_permissions=True)

		seed_saved_views()

		section = shared_section("CRM Deal", "Views")
		self.assertNotIn("Open", view_labels(section))
		self.assertEqual(len(section.items), 4)

# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import json

import frappe
from frappe.tests import IntegrationTestCase

from crm.saved_views.seed import seed_saved_views


def clear_saved_views(*doctypes):
	for doctype in doctypes:
		for group in frappe.get_all("Saved View Group", {"reference_doctype": doctype}, pluck="name"):
			frappe.delete_doc("Saved View Group", group, force=True, ignore_permissions=True)
		for view in frappe.get_all("Saved View", {"reference_doctype": doctype}, pluck="name"):
			frappe.delete_doc("Saved View", view, force=True, ignore_permissions=True)


def shared_group(doctype, label):
	name = frappe.db.get_value(
		"Saved View Group",
		{"reference_doctype": doctype, "label": label, "user": ("in", ("", None))},
		"name",
	)
	return frappe.get_doc("Saved View Group", name) if name else None


def view_labels(group):
	return [frappe.db.get_value("Saved View", row.view, "label") for row in group.views]


def view_by_label(group, label):
	for row in group.views:
		view = frappe.get_doc("Saved View", row.view)
		if view.label == label:
			return view
	return None


class TestSeed(IntegrationTestCase):
	def setUp(self):
		clear_saved_views("CRM Deal", "CRM Lead")
		seed_saved_views()

	def tearDown(self):
		frappe.db.rollback()

	def test_deals_views_section(self):
		group = shared_group("CRM Deal", "Views")
		self.assertEqual(view_labels(group), ["All", "Open", "My open", "Closing this month", "Unassigned"])

	def test_leads_views_section_has_no_closing_view(self):
		group = shared_group("CRM Lead", "Views")
		self.assertEqual(view_labels(group), ["All", "Open", "My open", "Unassigned"])

	def test_all_carries_no_filter(self):
		view = view_by_label(shared_group("CRM Deal", "Views"), "All")
		self.assertEqual(json.loads(view.filters), [])

	def test_open_filters_on_the_open_statuses(self):
		open_statuses = frappe.get_all(
			"CRM Deal Status", {"type": ("not in", ("Won", "Lost"))}, pluck="name", order_by="position asc"
		)
		view = view_by_label(shared_group("CRM Deal", "Views"), "Open")
		self.assertEqual(json.loads(view.filters), [["status", "in", open_statuses]])

	def test_my_open_filters_on_the_current_user(self):
		view = view_by_label(shared_group("CRM Deal", "Views"), "My open")
		self.assertIn(["deal_owner", "=", "@me"], json.loads(view.filters))

	def test_unassigned_filters_on_owner_not_set(self):
		view = view_by_label(shared_group("CRM Lead", "Views"), "Unassigned")
		self.assertEqual(json.loads(view.filters), [["lead_owner", "is", "not set"]])

	def test_views_carry_lucide_icons(self):
		group = shared_group("CRM Deal", "Views")
		self.assertEqual(view_by_label(group, "All").icon, "list")
		self.assertEqual(view_by_label(group, "Unassigned").icon, "user-x")

	def test_pipeline_has_a_coloured_view_per_deal_status(self):
		statuses = frappe.get_all("CRM Deal Status", fields=["name", "color"], order_by="position asc")
		group = shared_group("CRM Deal", "Pipeline")

		self.assertEqual(view_labels(group), [status.name for status in statuses])
		for row, status in zip(group.views, statuses, strict=True):
			view = frappe.get_doc("Saved View", row.view)
			self.assertEqual(view.icon, status.color)
			self.assertEqual(json.loads(view.filters), [["status", "=", status.name]])
			self.assertEqual(view.user, "")

	def test_views_section_sits_before_pipeline(self):
		self.assertLess(
			shared_group("CRM Deal", "Views").sequence, shared_group("CRM Deal", "Pipeline").sequence
		)

	def test_rerun_creates_no_duplicate_groups_or_views(self):
		seed_saved_views()

		groups = frappe.get_all(
			"Saved View Group",
			{"reference_doctype": "CRM Deal", "label": "Views", "user": ("in", ("", None))},
		)
		self.assertEqual(len(groups), 1)
		self.assertEqual(len(shared_group("CRM Deal", "Views").views), 5)

	def test_rerun_does_not_restore_a_manager_deleted_view(self):
		group = shared_group("CRM Deal", "Views")
		removed = view_by_label(group, "Open").name
		group.views = [row for row in group.views if str(row.view) != str(removed)]
		group.save(ignore_permissions=True)
		frappe.delete_doc("Saved View", removed, force=True, ignore_permissions=True)

		seed_saved_views()

		group = shared_group("CRM Deal", "Views")
		self.assertNotIn("Open", view_labels(group))
		self.assertEqual(len(group.views), 4)

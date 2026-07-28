# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.desk.doctype.navigation_section.scope import UNSET, Scope
from frappe.tests import IntegrationTestCase

from crm.navigation.doctype_items import added_doctypes
from crm.navigation.test_page_items import StudioPageTestCase, make_page
from crm.saved_views.scope import CRM_APP

UNSEEDED_DOCTYPE = "Comment"


def views_section(doctype: str) -> str | None:
	return frappe.db.get_value(
		"Navigation Section",
		{**Scope(CRM_APP, doctype).filters(), "label": "Views", "user": UNSET, "overrides": UNSET},
	)


def drop_views_section(doctype: str):
	name = views_section(doctype)
	if name:
		frappe.delete_doc("Navigation Section", name, force=True, ignore_permissions=True)


class TestAddedDoctypes(IntegrationTestCase):
	def test_names_every_doctype_row_of_a_section_being_inserted(self):
		section = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": "Rail",
				"app": CRM_APP,
				"items": [
					{"type": "doctype", "label": "Leads", "dt": "CRM Lead"},
					{"type": "link", "label": "Docs", "url": "https://frappe.io"},
				],
			}
		)
		self.assertEqual(added_doctypes(section), ["CRM Lead"])


class TestSeedViewsForNewDoctypeItems(IntegrationTestCase):
	def setUp(self):
		drop_views_section(UNSEEDED_DOCTYPE)
		self.addCleanup(drop_views_section, UNSEEDED_DOCTYPE)

	def test_a_doctype_item_seeds_that_doctypes_all_view(self):
		self.make_section([{"type": "doctype", "label": "Comments", "dt": UNSEEDED_DOCTYPE}])

		section = views_section(UNSEEDED_DOCTYPE)
		self.assertTrue(section)
		views = frappe.get_doc("Navigation Section", section).items
		self.assertEqual([frappe.db.get_value("Saved View", view.view, "label") for view in views], ["All"])

	def test_another_apps_section_seeds_nothing(self):
		self.make_section([{"type": "doctype", "label": "Comments", "dt": UNSEEDED_DOCTYPE}], app="frappe")
		self.assertIsNone(views_section(UNSEEDED_DOCTYPE))

	def test_a_link_item_seeds_nothing(self):
		self.make_section([{"type": "link", "label": "Docs", "url": "https://frappe.io"}])
		self.assertIsNone(views_section(UNSEEDED_DOCTYPE))

	def test_a_doctype_item_added_later_seeds_its_views(self):
		section = self.make_section([{"type": "link", "label": "Docs", "url": "https://frappe.io"}])
		self.assertIsNone(views_section(UNSEEDED_DOCTYPE))

		section.append("items", {"type": "doctype", "label": "Comments", "dt": UNSEEDED_DOCTYPE})
		section.save(ignore_permissions=True)
		self.assertTrue(views_section(UNSEEDED_DOCTYPE))

	def test_resaving_a_doctype_item_does_not_reseed_a_deleted_section(self):
		section = self.make_section([{"type": "doctype", "label": "Comments", "dt": UNSEEDED_DOCTYPE}])
		drop_views_section(UNSEEDED_DOCTYPE)

		section.items[0].label = "Notes on records"
		section.save(ignore_permissions=True)
		self.assertIsNone(views_section(UNSEEDED_DOCTYPE))

	def make_section(self, items, app=CRM_APP):
		section = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": "Rail",
				"app": app,
				"user": "",
				"items": items,
			}
		).insert(ignore_permissions=True)
		self.addCleanup(
			frappe.delete_doc, "Navigation Section", section.name, force=True, ignore_permissions=True
		)
		return section


class TestPageItemsSeedNothing(StudioPageTestCase):
	"""The type CRM adds carries no `dt`, so the hook has to pass it over the same way
	it passes over a link."""

	def setUp(self):
		super().setUp()
		drop_views_section(UNSEEDED_DOCTYPE)
		self.addCleanup(drop_views_section, UNSEEDED_DOCTYPE)

	def test_a_page_item_seeds_nothing(self):
		page = make_page("/reports")
		section = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": "Rail",
				"app": CRM_APP,
				"user": "",
				"items": [{"type": "page", "label": "Reports", "page": page.name}],
			}
		).insert(ignore_permissions=True)
		self.addCleanup(
			frappe.delete_doc, "Navigation Section", section.name, force=True, ignore_permissions=True
		)

		self.assertEqual(added_doctypes(section), [])
		self.assertIsNone(views_section(UNSEEDED_DOCTYPE))

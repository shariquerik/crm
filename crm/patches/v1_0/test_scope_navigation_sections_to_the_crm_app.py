# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.desk.doctype.navigation_section.navigation_section import get_sidebar
from frappe.tests import IntegrationTestCase

from crm.patches.v1_0.scope_navigation_sections_to_the_crm_app import execute
from crm.saved_views.scope import CRM_APP
from crm.saved_views.test_seed import clear_saved_views

DOCTYPE = "CRM Deal"


def make_view(label):
	return frappe.get_doc(
		{"doctype": "Saved View", "label": label, "reference_doctype": DOCTYPE, "type": "list"}
	).insert(ignore_permissions=True)


def make_unscoped_section(label, views):
	"""A section as it stood before sections had an app.

	`app` is mandatory now, so the pre-patch shape has to be written to the column
	rather than inserted.
	"""
	section = frappe.get_doc(
		{
			"doctype": "Navigation Section",
			"label": label,
			"app": CRM_APP,
			"reference_doctype": DOCTYPE,
			"views": [{"view": view.name} for view in views],
		}
	).insert(ignore_permissions=True)
	frappe.db.set_value("Navigation Section", section.name, "app", "", update_modified=False)
	return section


def app_of(section):
	return frappe.db.get_value("Navigation Section", section.name, "app")


def placed(section):
	section.reload()
	return [str(row.view) for row in section.views]


def names(*views):
	return [str(view.name) for view in views]


class TestScopeNavigationSectionsToTheCrmApp(IntegrationTestCase):
	def setUp(self):
		clear_saved_views(DOCTYPE)
		self.first, self.second = make_view("First"), make_view("Second")
		self.section = make_unscoped_section("Views", [self.first, self.second])

	def tearDown(self):
		frappe.db.rollback()

	def test_an_unscoped_section_is_stamped_with_the_crm_app(self):
		execute()

		self.assertEqual(app_of(self.section), CRM_APP)

	def test_a_stamped_section_reaches_the_crm_sidebar(self):
		"""The stamp is the whole point: sidebar reads filter on the app, so a section
		left unscoped is a section nobody sees."""
		execute()

		self.assertIn(
			"Views", [section["label"] for section in get_sidebar(DOCTYPE, app=CRM_APP)["sections"]]
		)

	def test_the_views_a_stamped_section_holds_stay_placed(self):
		execute()

		self.assertEqual(placed(self.section), names(self.first, self.second))

	def test_a_rerun_changes_nothing(self):
		"""The section is the same record after both runs, not a recreated one: a stamp
		that recreated sections would unplace every view they hold."""
		execute()
		before = frappe.db.get_value(
			"Navigation Section", self.section.name, ["creation", "modified"], as_dict=True
		)

		execute()

		self.assertEqual(app_of(self.section), CRM_APP)
		self.assertEqual(placed(self.section), names(self.first, self.second))
		self.assertEqual(
			frappe.db.get_value(
				"Navigation Section", self.section.name, ["creation", "modified"], as_dict=True
			),
			before,
		)

	def test_a_section_belonging_to_another_app_is_left_alone(self):
		other = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": "Other",
				"app": "helpdesk",
				"reference_doctype": DOCTYPE,
			}
		).insert(ignore_permissions=True)

		execute()

		self.assertEqual(app_of(other), "helpdesk")

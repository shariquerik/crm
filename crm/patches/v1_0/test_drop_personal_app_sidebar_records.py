# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import json

import frappe
from frappe.tests import IntegrationTestCase

from crm.fcrm.doctype.crm_ui_customization.crm_ui_customization import get_sidebar_layout
from crm.patches.v1_0.drop_personal_app_sidebar_records import execute

SHARED_SIDEBAR = "App Sidebar"


def make_record(user, layout):
	return frappe.get_doc(
		{
			"doctype": "CRM UI Customization",
			"type": SHARED_SIDEBAR,
			"user": user,
			"json": json.dumps(layout),
		}
	).insert(ignore_permissions=True)


def surviving(user):
	return frappe.db.exists("CRM UI Customization", {"type": SHARED_SIDEBAR, "user": user})


class TestDropPersonalAppSidebarRecords(IntegrationTestCase):
	def setUp(self):
		frappe.db.delete("CRM UI Customization", {"type": SHARED_SIDEBAR})

	def tearDown(self):
		frappe.db.rollback()

	def test_a_users_own_rail_is_dropped(self):
		make_record("Administrator", [{"dt": "CRM Deal"}])

		execute()

		self.assertFalse(surviving("Administrator"))

	def test_the_shared_record_survives(self):
		"""It is a fixture the classic frontend still reads, and the seed the rail's
		navigation section was taken from."""
		make_record(None, [{"label": "CRM", "items": [{"dt": "CRM Deal"}]}])

		execute()

		self.assertEqual(get_sidebar_layout(), [{"label": "CRM", "items": [{"dt": "CRM Deal"}]}])

	def test_a_customization_of_another_type_survives(self):
		other = frappe.get_doc(
			{
				"doctype": "CRM UI Customization",
				"type": "Quick Filters",
				"dt": "CRM Deal",
				"user": "Administrator",
				"json": "{}",
			}
		).insert(ignore_permissions=True)

		execute()

		self.assertTrue(frappe.db.exists("CRM UI Customization", other.name))

	def test_a_rerun_on_a_clean_site_changes_nothing(self):
		execute()

		execute()

		self.assertFalse(surviving("Administrator"))

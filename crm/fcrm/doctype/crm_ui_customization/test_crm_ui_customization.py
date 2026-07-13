# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

# The doctype is copied from PR frappe/crm#1524, commit
# 51eb481c57b016c4d275e583d2bd0bc8e3bb6abb (see crm_ui_customization.py). The PR
# ships only an empty test stub; these tests cover what this app relies on — the
# sidebar-data API — plus the autoname contract get_sidebar_layout depends on.

import json

import frappe
from frappe.tests import IntegrationTestCase

from crm.fcrm.doctype.crm_ui_customization.crm_ui_customization import get_sidebar_layout

SIDEBAR_LAYOUT = [
	{
		"name": "crm",
		"label": "CRM",
		"items": [
			{"label": "Leads", "dt": "CRM Lead", "icon": "users"},
			{"label": "Deals", "dt": "CRM Deal", "icon": "briefcase"},
		],
	}
]


class IntegrationTestCRMUICustomization(IntegrationTestCase):
	def setUp(self):
		frappe.db.delete("CRM UI Customization", {"type": "App Sidebar"})

	def tearDown(self):
		frappe.db.delete("CRM UI Customization", {"type": "App Sidebar"})

	def _make_sidebar(self, disabled=0, layout=None):
		doc = frappe.get_doc(
			{
				"doctype": "CRM UI Customization",
				"type": "App Sidebar",
				"disabled": disabled,
				"json": json.dumps(SIDEBAR_LAYOUT if layout is None else layout),
			}
		)
		doc.insert()
		return doc

	def test_autonames_from_type_and_sets_title(self):
		doc = self._make_sidebar()
		# get_sidebar_layout() fetches by the literal name "App Sidebar", so a
		# sidebar record with no dt/user must autoname to exactly that.
		self.assertEqual(doc.name, "App Sidebar")
		self.assertEqual(doc.title, "App Sidebar")

	def test_get_sidebar_layout_returns_sections_and_doctypes(self):
		self._make_sidebar()
		layout = get_sidebar_layout()

		self.assertEqual(len(layout), 1)
		self.assertEqual(layout[0]["label"], "CRM")
		self.assertEqual([item["dt"] for item in layout[0]["items"]], ["CRM Lead", "CRM Deal"])

	def test_get_sidebar_layout_returns_empty_list_when_not_configured(self):
		self.assertEqual(get_sidebar_layout(), [])

	def test_get_sidebar_layout_ignores_disabled_record(self):
		self._make_sidebar(disabled=1)
		self.assertEqual(get_sidebar_layout(), [])

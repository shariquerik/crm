# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.desk.doctype.navigation_section.navigation_section import get_sidebar
from frappe.tests import IntegrationTestCase

from crm.navigation.page_items import STUDIO_APP, page_targets
from crm.saved_views.scope import CRM_APP


def make_page(route, published=1, studio_app=STUDIO_APP):
	return frappe.get_doc(
		{
			"doctype": "Studio Page",
			"page_title": "Test Page",
			"route": route,
			"published": published,
			"studio_app": studio_app,
		}
	).insert(ignore_permissions=True)


def make_section(items, label="Extras", reference_doctype=None):
	return frappe.get_doc(
		{
			"doctype": "Navigation Section",
			"label": label,
			"app": CRM_APP,
			"reference_doctype": reference_doctype,
			"items": items,
		}
	).insert(ignore_permissions=True)


def page_item(page, label="Reports"):
	return {"type": "page", "label": label, "page": page.name}


def make_other_app():
	if not frappe.db.exists("Studio App", "other-app"):
		frappe.get_doc({"doctype": "Studio App", "app_name": "other-app", "app_title": "Other App"}).insert(
			ignore_permissions=True
		)
	return "other-app"


class StudioPageTestCase(IntegrationTestCase):
	def setUp(self):
		developer_mode = patch.dict(frappe.conf, {"developer_mode": 0})
		developer_mode.start()
		self.addCleanup(developer_mode.stop)


class TestPageTargets(StudioPageTestCase):
	"""Where a page item leads is worked out from the page record on every read, which
	is the whole reason the item stores the page rather than a URL."""

	def test_the_route_comes_from_the_page_record(self):
		page = make_page("/reports")
		section = make_section([page_item(page)])

		self.assertEqual(page_targets([section.items[0].name]), {section.items[0].name: "/reports"})

	def test_a_renamed_route_is_followed(self):
		page = make_page("/reports")
		section = make_section([page_item(page)])

		page.route = "/insights"
		page.save(ignore_permissions=True)

		self.assertEqual(page_targets([section.items[0].name])[section.items[0].name], "/insights")

	def test_an_unpublished_page_is_answered_for_with_nothing(self):
		page = make_page("/drafts", published=0)
		section = make_section([page_item(page)])

		self.assertEqual(page_targets([section.items[0].name]), {})

	def test_a_page_moved_to_another_app_is_answered_for_with_nothing(self):
		"""Routes are relative to the app that owns the page, so one that has left CRM's
		leads at an address this frontend does not serve."""
		page = make_page("/reports")
		section = make_section([page_item(page)])
		frappe.db.set_value("Studio Page", page.name, "studio_app", make_other_app())

		self.assertEqual(page_targets([section.items[0].name]), {})

	def test_a_row_of_another_type_is_left_to_the_framework(self):
		section = make_section([{"type": "link", "label": "Docs", "url": "/docs"}])

		self.assertEqual(page_targets([section.items[0].name]), {})

	def test_no_rows_asks_nothing(self):
		self.assertEqual(page_targets([]), {})


class TestPageItemValidation(StudioPageTestCase):
	"""The framework requires nothing of a type it does not know, so a page item's own
	rules are enforced from here."""

	def test_a_page_item_needs_a_page(self):
		with self.assertRaises(frappe.MandatoryError):
			make_section([{"type": "page", "label": "Reports"}])

	def test_a_page_item_needs_a_label(self):
		page = make_page("/reports")

		with self.assertRaises(frappe.MandatoryError):
			make_section([{"type": "page", "page": page.name}])

	def test_a_page_from_another_app_is_refused(self):
		page = make_page("/reports", studio_app=make_other_app())

		with self.assertRaises(frappe.ValidationError):
			make_section([page_item(page)])

	def test_a_parameterised_route_is_refused(self):
		"""CRM's own list page answers to `/:doctype` — it has no one address, so nothing
		can be sent to it, the way a SINGLE has no list for a doctype item to open."""
		page = make_page("/:doctype")

		with self.assertRaises(frappe.ValidationError):
			make_section([page_item(page)])

	def test_an_overlay_row_carries_no_content_to_check(self):
		shared = make_section([page_item(make_page("/reports"))])

		overlay = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": "Extras",
				"app": CRM_APP,
				"user": frappe.session.user,
				"overrides": shared.name,
				"items": [{"overrides": shared.items[0].name, "hidden": 1}],
			}
		).insert(ignore_permissions=True)

		self.assertEqual(len(overlay.items), 1)


class TestPageItemsOnTheSidebar(StudioPageTestCase):
	"""The whole path: the framework hands the rows of a type it does not know to the
	`navigation_item_targets` hook, and draws them by what comes back."""

	def items_of(self, section):
		sidebar = get_sidebar(reference_doctype="CRM Deal", app=CRM_APP)
		for rendered in sidebar["sections"]:
			if rendered["name"] == section.name:
				return rendered["items"]
		return []

	def test_a_page_item_arrives_with_its_route(self):
		page = make_page("/reports")
		section = make_section([page_item(page)], reference_doctype="CRM Deal")

		items = self.items_of(section)

		self.assertEqual(
			[(item["type"], item["label"], item["url"]) for item in items],
			[("page", "Reports", "/reports")],
		)

	def test_an_unpublished_page_is_left_out(self):
		page = make_page("/drafts", published=0)
		section = make_section([page_item(page)], reference_doctype="CRM Deal")

		self.assertEqual(self.items_of(section), [])


class TestPageLinkIntegrity(StudioPageTestCase):
	def test_deleting_a_page_an_item_points_at_is_blocked(self):
		"""Unlike the `dt` Link, which a DocType delete takes no notice of, a page is an
		ordinary document and Frappe's link check reaches the item's custom field."""
		page = make_page("/reports")
		make_section([page_item(page)])

		with self.assertRaises(frappe.LinkExistsError):
			frappe.delete_doc("Studio Page", page.name)

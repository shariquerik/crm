# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.desk.doctype.navigation_section.navigation_section import get_sidebar
from frappe.desk.doctype.navigation_section.scope import UNSET
from frappe.tests import IntegrationTestCase

from crm.navigation.rail import (
	RAIL_SCOPE,
	addable_doctypes,
	rail_items,
	seed_rail,
	shared_sidebar_layout,
)
from crm.saved_views.scope import CRM_APP


def drop_rail():
	for name in frappe.get_all("Navigation Section", filters={**RAIL_SCOPE.filters()}, pluck="name"):
		frappe.delete_doc("Navigation Section", name, force=True, ignore_permissions=True)


def rail_rows() -> list[dict]:
	"""What the rail renders: every app-level section flattened, as the client does."""
	sidebar = get_sidebar(app=CRM_APP)
	return [item for section in sidebar["sections"] for item in section["items"]]


class TestSharedSidebarLayout(IntegrationTestCase):
	def test_reads_the_fixture_file(self):
		sections = shared_sidebar_layout()
		self.assertTrue(sections)
		self.assertTrue(all(item["dt"] for section in sections for item in section["items"]))


class TestRailItems(IntegrationTestCase):
	def test_carries_the_label_and_icon_the_fixture_gives(self):
		entry = {"dt": "CRM Lead", "label": "Leads", "icon": "user-plus", "type": "doctype"}
		self.assertEqual(
			rail_items([entry]),
			[{"type": "doctype", "label": "Leads", "icon": "user-plus", "dt": "CRM Lead"}],
		)

	def test_falls_back_to_the_doctype_name_for_a_label(self):
		self.assertEqual(rail_items([{"dt": "CRM Lead"}])[0]["label"], "CRM Lead")

	def test_drops_an_entry_whose_doctype_the_site_does_not_have(self):
		self.assertEqual(rail_items([{"dt": "No Such Doctype", "label": "Gone"}]), [])


class TestSeedRail(IntegrationTestCase):
	def setUp(self):
		drop_rail()
		# Cleanups run last-registered-first, so this reads bottom-up: drop, then reseed.
		self.addCleanup(seed_rail)
		self.addCleanup(drop_rail)

	def test_seeds_the_fixture_as_a_shared_app_level_section(self):
		seed_rail()

		sections = frappe.get_all(
			"Navigation Section",
			filters={**RAIL_SCOPE.filters(), "user": UNSET},
			fields=["name", "reference_doctype", "user"],
		)
		self.assertEqual(len(sections), 1)
		self.assertFalse(sections[0].reference_doctype)
		self.assertFalse(sections[0].user)

	def test_seeds_the_fixture_doctypes_in_order_with_their_labels_and_icons(self):
		seed_rail()

		expected = [
			item for section in shared_sidebar_layout() for item in section["items"] if item.get("dt")
		]
		rows = rail_rows()
		self.assertEqual([row["dt"] for row in rows], [item["dt"] for item in expected])
		self.assertEqual([row["label"] for row in rows], [item["label"] for item in expected])
		self.assertEqual([row["icon"] for row in rows], [item["icon"] for item in expected])
		self.assertTrue(all(row["type"] == "doctype" for row in rows))

	def test_every_seeded_item_resolves_to_its_list_route(self):
		seed_rail()
		self.assertTrue(all(row["url"] == f"/{row['dt'].replace(' ', '%20')}" for row in rail_rows()))

	def test_seeding_twice_leaves_one_rail(self):
		seed_rail()
		seeded = len(rail_rows())

		seed_rail()
		self.assertEqual(len(rail_rows()), seeded)
		self.assertEqual(frappe.db.count("Navigation Section", {**RAIL_SCOPE.filters(), "user": UNSET}), 1)

	def test_leaves_an_arranged_rail_alone(self):
		seed_rail()
		section = frappe.db.get_value("Navigation Section", {**RAIL_SCOPE.filters(), "user": UNSET})
		doc = frappe.get_doc("Navigation Section", section)
		doc.items = doc.items[:2]
		doc.save(ignore_permissions=True)

		seed_rail()
		self.assertEqual(len(rail_rows()), 2)


class TestAddableDoctypes(IntegrationTestCase):
	def test_offers_a_listable_doctype(self):
		self.assertIn("CRM Deal", addable_doctypes())

	def test_leaves_out_a_single_and_a_child_table(self):
		offered = set(addable_doctypes())
		self.assertNotIn("FCRM Settings", offered)
		self.assertNotIn("Navigation Item", offered)

	def test_leaves_out_a_doctype_the_session_user_cannot_read(self):
		frappe.set_user("Guest")
		self.addCleanup(frappe.set_user, "Administrator")

		self.assertNotIn("CRM Deal", addable_doctypes())


class TestRailFlattening(IntegrationTestCase):
	"""The rail reads *all* app-level sections; the flattening itself is the client's."""

	def setUp(self):
		drop_rail()
		# Cleanups run last-registered-first, so this reads bottom-up: drop, then reseed.
		self.addCleanup(seed_rail)
		self.addCleanup(drop_rail)

	def test_returns_every_app_level_section_in_sequence_order(self):
		self.make_section("First", 1, [{"type": "link", "label": "Docs", "url": "https://frappe.io"}])
		self.make_section("Second", 2, [{"type": "doctype", "label": "Leads", "dt": "CRM Lead"}])

		sidebar = get_sidebar(app=CRM_APP)
		self.assertEqual([section["label"] for section in sidebar["sections"]], ["First", "Second"])
		self.assertEqual([row["label"] for row in rail_rows()], ["Docs", "Leads"])

	def test_leaves_a_doctype_section_out_of_the_rail(self):
		self.make_section("Views", 1, [{"type": "doctype", "label": "Leads", "dt": "CRM Lead"}], "Contact")
		self.assertEqual(rail_rows(), [])

	def make_section(self, label, sequence, items, reference_doctype=""):
		section = frappe.get_doc(
			{
				"doctype": "Navigation Section",
				"label": label,
				"app": CRM_APP,
				"reference_doctype": reference_doctype,
				"user": "",
				"sequence": sequence,
				"items": items,
			}
		).insert(ignore_permissions=True)
		self.addCleanup(
			frappe.delete_doc, "Navigation Section", section.name, force=True, ignore_permissions=True
		)
		return section

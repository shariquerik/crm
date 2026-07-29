# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import json

import frappe
from frappe.tests import IntegrationTestCase

from crm.saved_views.migrate import migrate_crm_view_settings
from crm.saved_views.seed import seed_saved_views
from crm.saved_views.test_seed import clear_saved_views, shared_section


def make_user(email):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"roles": [{"role": "Sales User"}],
			}
		).insert(ignore_permissions=True)
	return email


def make_legacy(dt="CRM Deal", **kwargs):
	return frappe.get_doc({"doctype": "CRM View Settings", "dt": dt, **kwargs}).insert(
		ignore_permissions=True
	)


def personal_section(doctype, user):
	name = frappe.db.get_value(
		"Navigation Section",
		{"reference_doctype": doctype, "label": "Personal", "user": user, "overrides": ("in", ("", None))},
		"name",
	)
	return frappe.get_doc("Navigation Section", name) if name else None


def section_holds(section, label):
	return section is not None and label in [
		frappe.db.get_value("Saved View", row.view, "label") for row in section.items
	]


def is_placed(view_name):
	return bool(frappe.db.exists("Navigation Item", {"view": view_name}))


def find_view(doctype, label, user):
	return frappe.db.get_value(
		"Saved View", {"reference_doctype": doctype, "label": label, "user": user}, "name"
	)


class TestMigrate(IntegrationTestCase):
	def setUp(self):
		clear_saved_views("CRM Deal", "CRM Lead")
		self.user = make_user("saved-view-migrate@example.com")

	def tearDown(self):
		frappe.db.rollback()

	def test_a_public_view_joins_the_shared_views_section(self):
		make_legacy(label="Team pipeline", user="", public=1)

		migrate_crm_view_settings()

		self.assertTrue(section_holds(shared_section("CRM Deal", "Views"), "Team pipeline"))
		self.assertTrue(find_view("CRM Deal", "Team pipeline", ""))

	def test_a_pinned_view_joins_that_users_personal_section(self):
		make_legacy(label="My deals", user=self.user, pinned=1)

		migrate_crm_view_settings()

		self.assertTrue(section_holds(personal_section("CRM Deal", self.user), "My deals"))

	def test_an_unpinned_private_view_lands_in_the_pool(self):
		make_legacy(label="Scratch", user=self.user)

		migrate_crm_view_settings()

		name = find_view("CRM Deal", "Scratch", self.user)
		self.assertTrue(name)
		self.assertFalse(is_placed(name))

	def test_a_standard_view_becomes_the_users_default(self):
		make_legacy(label="List", user=self.user, is_standard=1)

		migrate_crm_view_settings()

		name = find_view("CRM Deal", "List", self.user)
		self.assertEqual(frappe.db.get_value("Saved View", name, "is_default"), 1)
		self.assertFalse(is_placed(name))

	def test_filters_reshape_from_dict_to_wire_list(self):
		make_legacy(
			label="Owned open",
			user="",
			public=1,
			filters=json.dumps({"deal_owner": "@me", "status": ["in", ["Qualification"]]}),
		)

		migrate_crm_view_settings()

		name = find_view("CRM Deal", "Owned open", "")
		self.assertEqual(
			json.loads(frappe.db.get_value("Saved View", name, "filters")),
			[["deal_owner", "=", "@me"], ["status", "in", ["Qualification"]]],
		)

	def test_kanban_configuration_survives(self):
		make_legacy(
			label="Board",
			user=self.user,
			pinned=1,
			type="kanban",
			column_field="status",
			title_field="organization",
			kanban_columns=json.dumps([{"column": "Qualification"}]),
			kanban_fields=json.dumps(["organization", "status"]),
		)

		migrate_crm_view_settings()

		view = frappe.get_doc("Saved View", find_view("CRM Deal", "Board", self.user))
		self.assertEqual(view.type, "kanban")
		self.assertEqual(view.column_field, "status")
		self.assertEqual(view.title_field, "organization")
		self.assertEqual(json.loads(view.kanban_columns), [{"column": "Qualification"}])
		self.assertEqual(json.loads(view.kanban_fields), ["organization", "status"])

	def test_columns_and_sort_copy_across_untouched(self):
		columns = json.dumps([{"key": "organization", "label": "Organization", "width": "12rem"}])
		make_legacy(label="Wide", user=self.user, pinned=1, order_by="creation desc", columns=columns)

		migrate_crm_view_settings()

		view = frappe.get_doc("Saved View", find_view("CRM Deal", "Wide", self.user))
		self.assertEqual(view.order_by, "creation desc")
		self.assertEqual(view.columns, columns)

	def test_a_seeded_label_does_not_shadow_a_users_public_view(self):
		seed_saved_views()
		make_legacy(
			label="Open",
			user="",
			public=1,
			filters=json.dumps({"deal_owner": "@me"}),
		)

		migrate_crm_view_settings()

		opens = frappe.get_all("Saved View", {"reference_doctype": "CRM Deal", "label": "Open"}, pluck="name")
		self.assertEqual(len(opens), 2)
		migrated = frappe.get_all(
			"Saved View",
			{"reference_doctype": "CRM Deal", "label": "Open", "filters": ["like", "%deal_owner%"]},
			pluck="name",
		)
		self.assertEqual(len(migrated), 1)
		self.assertTrue(section_holds(shared_section("CRM Deal", "Views"), "Open"))

	def test_group_by_configuration_survives(self):
		make_legacy(label="By status", user=self.user, pinned=1, type="group_by", group_by_field="status")

		migrate_crm_view_settings()

		view = frappe.get_doc("Saved View", find_view("CRM Deal", "By status", self.user))
		self.assertEqual(view.type, "group_by")
		self.assertEqual(view.group_by_field, "status")

	def test_migration_is_idempotent(self):
		make_legacy(label="Team pipeline", user="", public=1)
		make_legacy(label="My deals", user=self.user, pinned=1)

		migrate_crm_view_settings()
		migrate_crm_view_settings()

		self.assertEqual(
			len(frappe.get_all("Saved View", {"reference_doctype": "CRM Deal", "label": "Team pipeline"})), 1
		)
		self.assertEqual(len(shared_section("CRM Deal", "Views").items), 1)
		self.assertEqual(len(personal_section("CRM Deal", self.user).items), 1)

	def test_a_view_without_a_doctype_is_skipped(self):
		make_legacy(dt="", label="Orphan", user=self.user)

		migrate_crm_view_settings()

		self.assertFalse(frappe.db.exists("Saved View", {"label": "Orphan"}))

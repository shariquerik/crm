#!/usr/bin/env python
"""Tests for the seed suite. Run from the bench root:

    env/bin/python apps/crm/crm-seed/test_seed.py

These run against the real site (the seeds are idempotent, so this is safe and is
in fact the property being tested). They guard the contract every page seeder
relies on: seeding twice changes nothing, pages come out published, and the
standard-app export lands in apps/crm/studio/.
"""

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# apps/crm/crm-seed -> apps/crm -> apps -> the bench root
BENCH = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
os.chdir(os.path.join(BENCH, "sites"))

import frappe  # noqa: E402

import config  # noqa: E402
import pages  # noqa: E402
import seed as seed_module  # noqa: E402
import studio_docs  # noqa: E402
import ui_customization  # noqa: E402


SITE = os.environ.get("SITE", seed_module.DEFAULT_SITE)


class TestSeedSuite(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		frappe.init(site=SITE, sites_path=os.path.join(BENCH, "sites"))
		frappe.connect()
		frappe.set_user("Administrator")
		# Bring the site to the seeded state, skipping the slow vite build...
		seed_module.seed(build=False)
		# ...but the bundle has to exist for the app to serve at all, and it is a build
		# artifact (gitignored), so a fresh clone has none. Build it once, here, rather
		# than asserting it away.
		if studio_docs.build_is_missing():
			studio_docs.build_app()

	@classmethod
	def tearDownClass(cls):
		frappe.destroy()

	def test_reseeding_is_a_noop(self):
		self.assertEqual(seed_module.seed(build=False), 0)

	def test_single_page_reseed_is_a_noop_and_leaves_others_alone(self):
		others = {
			name: frappe.db.get_value("Studio Page", name, "modified")
			for name in pages.SEEDERS
			if name != "crm-home"
		}

		self.assertEqual(seed_module.seed(page_name="crm-home", build=False), 0)

		for name, modified in others.items():
			self.assertEqual(frappe.db.get_value("Studio Page", name, "modified"), modified)

	def test_unknown_page_is_rejected(self):
		with self.assertRaises(SystemExit):
			seed_module.seed(page_name="not-a-page", build=False)

	def test_app_is_standard_and_exports_to_crm(self):
		app = frappe.get_doc("Studio App", config.APP_NAME)
		self.assertEqual(app.route, config.APP_ROUTE)
		self.assertTrue(app.is_standard)
		self.assertEqual(app.frappe_app, "crm")

	def test_every_seeded_page_is_published_with_a_root_block(self):
		for page_name in pages.SEEDERS:
			with self.subTest(page=page_name):
				page = frappe.get_doc("Studio Page", page_name)
				self.assertTrue(page.published, f"{page_name} is not published")
				self.assertEqual(page.page_name, page_name)

				tree = json.loads(page.blocks)
				self.assertEqual(len(tree), 1, "blocks must hold exactly one root block")
				self.assertEqual(tree[0]["componentId"], "root")

	def test_home_page_is_at_the_app_root(self):
		self.assertEqual(frappe.db.get_value("Studio Page", "crm-home", "route"), "/")

	def test_pages_are_exported_as_json_under_the_crm_app(self):
		studio_dir = frappe.get_app_source_path("crm", "studio", config.APP_NAME)
		self.assertTrue(os.path.exists(os.path.join(studio_dir, f"{config.APP_NAME.replace('-', '_')}.json")))

		for page_name in pages.SEEDERS:
			with self.subTest(page=page_name):
				title = frappe.db.get_value("Studio Page", page_name, "page_title")
				stem = frappe.scrub(title)
				self.assertTrue(
					os.path.exists(os.path.join(studio_dir, "studio_page", stem, f"{stem}.json")),
					f"no exported JSON for {page_name}",
				)

	def test_sidebar_customization_matches_the_doctype_map(self):
		self.assertFalse(ui_customization.upsert(), "sidebar seed is not idempotent")

		layout = json.loads(frappe.db.get_value("CRM UI Customization", "App Sidebar", "json"))
		seeded = [item["dt"] for section in layout for item in section["items"]]
		self.assertEqual(seeded, [d["doctype"] for d in config.DOCTYPES])

	def test_slug_map_round_trips(self):
		for entry in config.DOCTYPES:
			self.assertEqual(config.doctype_for(entry["slug"]), entry["doctype"])
			self.assertEqual(config.slug_for(entry["doctype"]), entry["slug"])

	def test_build_detection_reports_the_bundle(self):
		# The bundle was built during ticket 02; if this flips, the route would 404.
		self.assertFalse(studio_docs.build_is_missing(), "app bundle is missing — run seed.py")


if __name__ == "__main__":
	unittest.main(verbosity=2)

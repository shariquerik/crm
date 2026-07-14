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

import frappe

import config
import pages
import seed as seed_module
import studio_docs
import ui_customization

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

	def test_sidebar_customization_lists_the_curated_doctypes(self):
		self.assertFalse(ui_customization.upsert(), "sidebar seed is not idempotent")

		layout = json.loads(frappe.db.get_value("CRM UI Customization", "App Sidebar", "json"))
		seeded = [item["dt"] for section in layout for item in section["items"]]
		self.assertEqual(seeded, [d["doctype"] for d in config.DOCTYPES])

	def test_no_page_carries_a_doctype_lookup_table(self):
		"""The routes carry the real doctype name (`/CRM Lead`), which is WHY the list and
		detail pages work for every doctype: a slug would need a reverse lookup, and any
		table baked into a page would cap the app at the doctypes known at seed time.

		So no page may declare a slug/doctype map — if one comes back, the pages have
		quietly become closed over a fixed list again.
		"""
		for page_name, builder in pages.SEEDERS.items():
			page = builder()
			names = [v["variable_name"] for v in page.get("variables", [])]
			with self.subTest(page=page_name):
				self.assertNotIn("doctypeMap", names)

			# and the doctype the pages act on comes from the route, not a lookup
			blob = json.dumps(page)
			with self.subTest(page=page_name):
				self.assertNotIn("doctypeMap[", blob)

	def test_doctype_routes_resolve_slug_case_and_typos(self):
		"""The one endpoint behind all three route behaviours: render / redirect / not found."""
		from crm.api.doc import resolve_doctype

		# canonical, and the two aliases that redirect to it
		for segment in ("CRM Lead", "crm-lead", "crm lead"):
			self.assertEqual(resolve_doctype(segment)["doctype"], "CRM Lead", segment)

		# the acronym: no client-side transform could recover "ToDo" from "todo" — this is
		# exactly why the resolution has to happen on the server
		self.assertEqual(resolve_doctype("todo")["doctype"], "ToDo")

		# nothing to show -> the page renders Not Found
		self.assertIsNone(resolve_doctype("nonsense")["doctype"])
		self.assertIsNone(resolve_doctype("System Settings")["doctype"])  # Single
		self.assertIsNone(resolve_doctype("Contact Phone")["doctype"])  # child table

	def test_guarded_pages_fetch_nothing_before_the_doctype_resolves(self):
		"""Every resource that takes the route's doctype must be auto=0 — an auto fetch would
		race the guard and query a doctype the URL may not even name."""
		for page_name in ("crm-list", "crm-view", "crm-detail"):
			page = pages.SEEDERS[page_name]()
			resources = {r["resource_name"]: r for r in page["resources"]}

			with self.subTest(page=page_name):
				self.assertIn("routeDoctype", resources, "page is not guarded")
				self.assertEqual(resources["routeDoctype"]["auto"], 1)

			for name, resource in resources.items():
				if name in ("routeDoctype", "sidebarLayout"):
					continue  # these take no doctype from the route
				with self.subTest(page=page_name, resource=name):
					self.assertEqual(resource["auto"], 0, f"{name} would fetch before the guard")

	def test_list_page_reads_its_doctype_from_the_route(self):
		page = pages.SEEDERS["crm-list"]()
		blob = json.dumps(page)

		# the four controls, the title and the list resource all bind the route param itself
		self.assertIn("{{ route.params.doctype }}", blob)
		# links back out must re-encode it — a doctype name has a space in it
		self.assertIn("encodeURIComponent(route.params.doctype)", blob)

	def test_build_detection_reports_the_bundle(self):
		# The bundle was built during ticket 02; if this flips, the route would 404.
		self.assertFalse(studio_docs.build_is_missing(), "app bundle is missing — run seed.py")


if __name__ == "__main__":
	unittest.main(verbosity=2)

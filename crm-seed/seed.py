#!/usr/bin/env python
"""Seed the CRM-on-Studio app.

The seed scripts are the source of truth for the app (docs/adr/0003): the Studio
builder is for inspecting, the JSON under apps/crm/studio/ is a generated artifact.
Re-running is safe — every step is an upsert and a no-op when nothing changed.

Run from the bench root:

    env/bin/python apps/crm/crm-seed/seed.py                 # seed everything + build
    env/bin/python apps/crm/crm-seed/seed.py --page crm-list # re-seed one page
    env/bin/python apps/crm/crm-seed/seed.py --no-build      # skip the (slow) vite build
    env/bin/python apps/crm/crm-seed/seed.py --list          # show what this suite owns

`bench execute` can't reach this package (the folder is hyphenated, so it isn't
importable), hence the explicit frappe.init/connect.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# apps/crm/crm-seed -> apps/crm -> apps -> the bench root
BENCH = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))

sys.path.insert(0, HERE)

import frappe  # noqa: E402

import components  # noqa: E402
import config  # noqa: E402
import pages  # noqa: E402
import studio_docs  # noqa: E402
import ui_customization  # noqa: E402

DEFAULT_SITE = "studio.localhost"


def seed(page_name: str | None = None, build: bool = True) -> int:
	changes = []

	if ui_customization.upsert():
		changes.append("CRM UI Customization: App Sidebar")

	_, app_changed = studio_docs.upsert_app()
	if app_changed:
		changes.append(f"Studio App: {config.APP_NAME}")

	components_changed = False
	for component_id, builder in components.SEEDERS.items():
		spec = builder()
		if studio_docs.upsert_component(
			component_id=component_id,
			component_name=spec["component_name"],
			block=spec["block"],
			inputs=spec["inputs"],
		):
			changes.append(f"Studio Component: {component_id}")
			components_changed = True

	if page_name:
		if page_name not in pages.SEEDERS:
			known = ", ".join(sorted(pages.SEEDERS)) or "(none)"
			raise SystemExit(f"Unknown page '{page_name}'. Known pages: {known}")
		selected = {page_name: pages.SEEDERS[page_name]}
	else:
		selected = pages.SEEDERS

	for name, builder in selected.items():
		if studio_docs.upsert_page(builder()):
			changes.append(f"Studio Page: {name}")

	# Only a full run may prune; a single-page run must not touch the others.
	if not page_name:
		for stale in studio_docs.delete_stale_pages(keep=list(pages.SEEDERS)):
			changes.append(f"removed stale Studio Page: {stale}")

	# Components reach disk only via a page's export, and the standard-app build reads
	# its component set from those files — so a component-only change would otherwise
	# leave the export (and the next build) stale.
	if components_changed:
		studio_docs.export_pages()

	frappe.db.commit()

	if changes:
		print("\nseeded:")
		for change in changes:
			print(f"  + {change}")
	else:
		print("\nno changes — already up to date")

	# The app bundle bakes in the component registry and the compiled page scripts, so
	# a content-only change still needs a rebuild for scripts to take effect. Build
	# also when the bundle is simply absent, or the route would 404 on a fresh clone.
	missing = studio_docs.build_is_missing()
	if build and (changes or missing):
		print("\nbuilding app bundle (vite)..." + (" [no bundle found]" if missing else ""))
		studio_docs.build_app()
		frappe.db.commit()
		print("build complete")
	elif build:
		print("skipping build — nothing changed")

	print(f"\napp: /{config.APP_ROUTE}/")
	return len(changes)


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
	parser.add_argument("--site", default=DEFAULT_SITE)
	parser.add_argument("--page", help="re-seed only this page (its Studio Page docname)")
	parser.add_argument("--no-build", action="store_true", help="skip the vite build")
	parser.add_argument("--list", action="store_true", help="list what this suite owns")
	args = parser.parse_args()

	if args.list:
		print(f"app       : {config.APP_NAME} (route /{config.APP_ROUTE}, exports to apps/{config.FRAPPE_APP})")
		print(f"pages     : {', '.join(sorted(pages.SEEDERS)) or '(none)'}")
		print(f"components: {', '.join(sorted(components.SEEDERS)) or '(none)'}")
		print(f"doctypes  : {', '.join(d['slug'] + ' -> ' + d['doctype'] for d in config.DOCTYPES)}")
		return

	# Frappe resolves bench paths (logs/, apps/) relative to the sites directory, so
	# it has to be the working directory — this is what `bench` itself does.
	sites_path = os.path.join(BENCH, "sites")
	os.chdir(sites_path)
	frappe.init(site=args.site, sites_path=sites_path)
	frappe.connect()
	frappe.set_user("Administrator")
	# Export to apps/crm/studio/ only happens in developer mode.
	if not frappe.conf.developer_mode:
		raise SystemExit("developer_mode must be 1 for the standard-app export to write files")

	try:
		seed(page_name=args.page, build=not args.no_build)
	finally:
		frappe.destroy()


if __name__ == "__main__":
	main()

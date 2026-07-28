# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt
import json
import os

import click
import frappe


def after_build():
	"""Build CRM's exported Studio apps after `bench build`.

	Studio ships its own `after_build` hook, but `run_after_build_hook` resolves hooks
	per app, so `bench build --app crm` never fires it. Owning the step here also lets us
	pass the Studio App's *document* name: `StudioAppBuilder` derives its output directory
	from the name as given, while `get_app_folder()` scrubs it to find the source folder.
	The renderer looks the assets up under the document name, so the folder name that
	`studio.build.build_standard_apps` passes builds to the wrong path.
	"""
	try:
		from studio.build import StudioAppBuilder
	except ImportError:
		return

	for app_name in get_studio_app_names():
		click.echo(f"\nBuilding Studio App: {app_name}")
		StudioAppBuilder(app_name, is_standard=True, frappe_app="crm").build()
		click.echo(click.style("✔", fg="green") + f" Built {app_name}")


def get_studio_app_names() -> list[str]:
	"""Return the document name of every Studio app exported to `crm/studio/`.

	Reads the exported doc off disk rather than the DB — `bench build` runs without a site.
	Folders with no `<folder>/<folder>.json` (`node_modules`, scratch dirs) are not apps.
	"""
	studio_folder = frappe.get_app_source_path("crm", "studio")
	if not os.path.isdir(studio_folder):
		return []

	app_names = []
	for entry in sorted(os.listdir(studio_folder)):
		doc_path = os.path.join(studio_folder, entry, f"{entry}.json")
		if not os.path.isfile(doc_path):
			continue

		try:
			with open(doc_path) as f:
				name = json.load(f).get("name")
		except (OSError, json.JSONDecodeError):
			continue

		if name:
			app_names.append(name)

	return app_names

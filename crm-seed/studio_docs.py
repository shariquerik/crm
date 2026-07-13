"""Idempotent upserts for Studio App / Page / Component documents.

Re-running a seed must produce the same result and, when nothing changed, must not
write at all. Each helper therefore diffs the desired state against the stored doc
and only saves on a real difference.

Studio traps handled here (see docs/how-studio-works.md):
  * Studio Page autonames to a random `page-<hash8>`; a deterministic docname needs
    insert(set_name=...). The docname must also be mirrored into `page_name`, since
    that is what the standard-app import keys off.
  * Studio Component's before_insert runs append_number_if_name_exists, so blindly
    re-inserting a component makes crm_sidebar_1, crm_sidebar_2, ... and pages keep
    pointing at the stale one. Always upsert by docname.
  * Child tables (resources/variables) duplicate on re-append; they are reset first.
  * A String or Object variable's initial_value is JSON.parse'd at runtime, so it
    must be stored JSON-encoded ('"hi"', not 'hi').
"""

import json

import frappe

import config

# What a page seeder returns: everything needed to materialize one Studio Page.
# (page_name doubles as the docname.)
PAGE_FIELDS = ("page_name", "page_title", "route", "blocks", "resources", "variables", "script")


def _json(value) -> str:
	return value if isinstance(value, str) else json.dumps(value, indent=1, sort_keys=False)


def _changed(doc, values: dict) -> list[str]:
	"""Field names whose stored value differs from the desired one."""
	diff = []
	for field, desired in values.items():
		current = doc.get(field)
		if isinstance(desired, str) or isinstance(current, str):
			if (current or "") != (desired or ""):
				diff.append(field)
		elif (current or 0) != (desired or 0):
			diff.append(field)
	return diff


# --- Studio App -------------------------------------------------------------


def upsert_app() -> tuple[object, bool]:
	"""Create or update the Studio App. Returns (doc, changed)."""
	values = {
		"app_title": config.APP_TITLE,
		"app_name": config.APP_NAME,
		"route": config.APP_ROUTE,
		"is_standard": 1,
		"frappe_app": config.FRAPPE_APP,
	}

	if not frappe.db.exists("Studio App", config.APP_NAME):
		doc = frappe.get_doc({"doctype": "Studio App", **values}).insert()
		return doc, True

	doc = frappe.get_doc("Studio App", config.APP_NAME)
	diff = _changed(doc, values)
	if diff:
		doc.update(values)
		doc.save()
	return doc, bool(diff)


# --- Studio Component -------------------------------------------------------


def upsert_component(component_id: str, component_name: str, block: dict, inputs: list[dict]) -> bool:
	"""Create or update a Studio Component. `component_id` is the docname that page
	blocks reference via componentName. Returns True if anything changed."""
	block_json = _json(block)

	if not frappe.db.exists("Studio Component", component_id):
		doc = frappe.get_doc(
			{
				"doctype": "Studio Component",
				"component_name": component_name,
				"component_id": component_id,
				"block": block_json,
				"inputs": inputs,
			}
		)
		# before_insert would rewrite component_id via append_number_if_name_exists;
		# set_name pins the docname so page blocks keep resolving.
		doc.insert(set_name=component_id)
		return True

	doc = frappe.get_doc("Studio Component", component_id)
	changed = bool(_changed(doc, {"component_name": component_name, "block": block_json}))
	changed = _sync_child_table(doc, "inputs", inputs) or changed
	if changed:
		doc.component_name = component_name
		doc.block = block_json
		doc.save()
	return changed


def _sync_child_table(doc, fieldname: str, rows: list[dict]) -> bool:
	"""Replace a child table if its desired rows differ. Returns True if replaced."""
	# Compare over the UNION of the desired rows' keys, not just the first row's:
	# sibling rows legitimately differ (one resource has a `transform`, another
	# doesn't), and keying off rows[0] would make those tables compare unequal
	# forever — re-saving the page on every run and breaking idempotency.
	keys = {k for row in rows for k in row}

	def norm(items):
		return [
			{k: ("" if item.get(k) is None else item.get(k)) for k in sorted(keys)} for item in items
		]

	# child rows carry name/idx/parent noise, so project both sides onto `keys`
	if norm(doc.get(fieldname)) == norm(rows):
		return False

	desired = [dict(r) for r in rows]

	doc.set(fieldname, [])
	for row in desired:
		doc.append(fieldname, row)
	return True


# --- Studio Page ------------------------------------------------------------


def _variable_rows(variables: list[dict]) -> list[dict]:
	"""Encode initial values the way Studio's runtime reads them back."""
	rows = []
	for var in variables:
		vtype = var.get("variable_type", "String")
		value = var.get("initial_value")
		if vtype in ("String", "Object"):
			initial = json.dumps(value if value is not None else ("" if vtype == "String" else {}))
		elif vtype == "Boolean":
			initial = "true" if value else "false"
		elif vtype == "Number":
			initial = str(value if value is not None else 0)
		else:
			initial = value
		rows.append(
			{"variable_name": var["variable_name"], "variable_type": vtype, "initial_value": initial}
		)
	return rows


def upsert_page(page: dict) -> bool:
	"""Create or update one Studio Page from a seeder's dict, publish it, and (for a
	standard app) write its script to the companion .ts. Returns True if changed."""
	page_name = page["page_name"]
	blocks_json = _json(page["blocks"])

	values = {
		"page_name": page_name,
		"page_title": page["page_title"],
		"route": page["route"],
		"studio_app": config.APP_NAME,
		"script": page.get("script") or "",
	}

	created = False
	if not frappe.db.exists("Studio Page", page_name):
		doc = frappe.get_doc(
			{
				"doctype": "Studio Page",
				**values,
				"draft_blocks": blocks_json,
			}
		)
		doc.insert(set_name=page_name)
		created = True
	else:
		doc = frappe.get_doc("Studio Page", page_name)

	resources = page.get("resources") or []
	variables = _variable_rows(page.get("variables") or [])

	changed = created
	# `blocks` holds the published tree; compare against it, not the (cleared) draft.
	if (doc.blocks or "") != blocks_json:
		changed = True
	# For a standard app the script lives in <page>.ts and the DB field is cleared,
	# so compare against the file, not doc.script.
	if (_exported_script(doc) or "") != (values["script"] or ""):
		changed = True
	if _changed(doc, {k: v for k, v in values.items() if k != "script"}):
		changed = True
	if _sync_child_table(doc, "resources", resources):
		changed = True
	if _sync_child_table(doc, "variables", variables):
		changed = True

	if not changed:
		# Nothing to publish, but the builder/preview draft still has to match what is
		# published (see the db_set below) — a page seeded before this existed has none.
		_sync_draft(doc, blocks_json)
		return False

	doc.update(values)
	doc.draft_blocks = blocks_json
	doc.set("resources", [])
	for row in resources:
		doc.append("resources", row)
	doc.set("variables", [])
	for row in variables:
		doc.append("variables", row)
	doc.save()

	# publish() validates route/title uniqueness among published pages, copies
	# draft_blocks -> blocks and clears the draft.
	doc.publish()

	# Standard pages load their compiled setup() module from the build, so the script
	# must land in <page>.ts. This also clears the DB `script` field.
	if doc.script:
		# Studio's export_script_to_file() only writes when the .ts is ABSENT (it exists to
		# move a script out of the DB once), so an edited script would be dropped on the
		# floor — and the DB field cleared with it. Delete the stale file first.
		_delete_exported_script(doc)
		doc.export_script_to_file()

	_sync_draft(doc, blocks_json)

	return True


def _sync_draft(doc, blocks_json: str) -> None:
	"""Keep draft_blocks equal to the published tree.

	publish() nulls draft_blocks, which leaves the Studio builder canvas and the /dev
	preview route blank — both read the draft. The seeds remain the source of truth,
	but ADR-0003 still expects the builder to be usable for INSPECTING the app, so the
	published tree goes back into the draft. db_set skips validation and re-export.
	"""
	if (doc.draft_blocks or "") != blocks_json:
		doc.db_set("draft_blocks", blocks_json, update_modified=False)


def export_pages() -> None:
	"""Re-export every page of the app to disk.

	Studio exports components only as a side effect of StudioPage.export_page() — a
	Studio Component has no export-on-update of its own. A standard app's build reads
	its component set FROM FILES (build.py get_app_components_from_files), so a run
	that changed only a component (leaving every page byte-identical, hence unsaved)
	would leave the exported JSON stale and the next build would bundle the wrong
	components. Forcing a re-export after a component change closes that hole.
	"""
	for page_name in frappe.get_all("Studio Page", filters={"studio_app": config.APP_NAME}, pluck="name"):
		frappe.get_doc("Studio Page", page_name).export_page()


def _delete_exported_script(doc) -> None:
	import os

	try:
		path = os.path.join(doc.get_folder_path(), f"{doc.get_export_docname()}.ts")
	except Exception:
		return
	if os.path.exists(path):
		os.remove(path)


def _exported_script(doc) -> str:
	"""The page script as it currently exists on disk (standard apps keep it in .ts)."""
	import os

	if doc.get("script"):
		return doc.script
	try:
		path = os.path.join(doc.get_folder_path(), f"{doc.get_export_docname()}.ts")
	except Exception:
		return ""
	if os.path.exists(path):
		return frappe.read_file(path)
	return ""


def delete_stale_pages(keep: list[str]) -> list[str]:
	"""Remove Studio Pages of this app that no seeder owns any more."""
	existing = frappe.get_all("Studio Page", filters={"studio_app": config.APP_NAME}, pluck="name")
	stale = [name for name in existing if name not in keep]
	for name in stale:
		frappe.delete_doc("Studio Page", name, force=True)
	return stale


def build_app() -> None:
	"""Vite-build the app bundle so the published pages are servable."""
	frappe.get_doc("Studio App", config.APP_NAME).generate_app_build()


def build_is_missing() -> bool:
	"""True when the app has no built bundle yet (fresh checkout, or it was cleaned).

	StudioAppRenderer serves the app off .vite/manifest.json, so its absence means the
	route 404s no matter how current the documents are.
	"""
	import os

	# get_app_path -> apps/crm/crm (the module dir, which is where public/ lives);
	# get_app_source_path -> apps/crm (the repo root, which is where studio/ lives).
	manifest = os.path.join(
		frappe.get_app_path(config.FRAPPE_APP, "public", "app_builds", config.APP_NAME),
		".vite",
		"manifest.json",
	)
	return not os.path.exists(manifest)

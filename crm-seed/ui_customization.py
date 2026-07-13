"""Seeds the `CRM UI Customization` "App Sidebar" record.

The sidebar's content is data, not code (PR 1524's design): the CRMSidebar component
reads it from crm.fcrm.doctype.crm_ui_customization.crm_ui_customization.get_sidebar_layout.
This seed writes that record from config.DOCTYPES so the sidebar and the slug<->doctype
map cannot drift apart.

get_sidebar_layout() fetches the doc by the literal name "App Sidebar", which is what
a record of type "App Sidebar" with no dt/user autonames to.
"""

import json

import frappe

import config

NAME = "App Sidebar"


def build() -> list[dict]:
	return [
		{
			"name": "crm",
			"label": "CRM",
			"opened": True,
			"items": [
				{
					"label": d["label"],
					"dt": d["doctype"],
					"slug": d["slug"],
					"icon": d["icon"],
					"type": "doctype",
				}
				for d in config.DOCTYPES
			],
		}
	]


def upsert() -> bool:
	layout = json.dumps(build(), indent=1)

	if not frappe.db.exists("CRM UI Customization", NAME):
		frappe.get_doc(
			{
				"doctype": "CRM UI Customization",
				"type": "App Sidebar",
				"disabled": 0,
				"json": layout,
			}
		).insert()
		return True

	doc = frappe.get_doc("CRM UI Customization", NAME)
	if (doc.json or "") == layout and not doc.disabled:
		return False

	doc.json = layout
	doc.disabled = 0
	doc.save()
	return True

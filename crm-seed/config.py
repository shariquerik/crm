"""Single source of truth for the CRM-on-Studio app's identity and its doctype map.

Per docs/adr/0003, these seed scripts are the source of truth for the Studio app;
the JSON exported under apps/crm/studio/ is a generated artifact.
"""

APP_NAME = "crm-studio"  # Studio App docname (app_name is the naming key)
APP_TITLE = "CRM on Studio"
APP_ROUTE = "crm-studio"  # served at /crm-studio/... ; /crm belongs to CRM's own frontend
FRAPPE_APP = "crm"  # standard-app export target -> apps/crm/studio/<APP_NAME>/


# --- slug <-> doctype -------------------------------------------------------
# The Generic List Page (ADR-0002) is one page at /:doctype, where :doctype is a
# URL slug, not a real doctype name. This list is the ONE place that mapping is
# defined; it is injected into pages as the `doctypeMap` variable and drives the
# sidebar, so nothing downstream hardcodes a doctype.

DOCTYPES = [
	{"slug": "crm-lead", "doctype": "CRM Lead", "label": "Leads", "icon": "user-plus"},
	{"slug": "crm-deal", "doctype": "CRM Deal", "label": "Deals", "icon": "briefcase"},
	{"slug": "contact", "doctype": "Contact", "label": "Contacts", "icon": "users"},
	{"slug": "crm-organization", "doctype": "CRM Organization", "label": "Organizations", "icon": "home"},
	{"slug": "crm-task", "doctype": "CRM Task", "label": "Tasks", "icon": "check-square"},
	{"slug": "fcrm-note", "doctype": "FCRM Note", "label": "Notes", "icon": "edit"},
]

SLUG_TO_DOCTYPE = {d["slug"]: d["doctype"] for d in DOCTYPES}
DOCTYPE_TO_SLUG = {d["doctype"]: d["slug"] for d in DOCTYPES}


def slug_for(doctype: str) -> str | None:
	return DOCTYPE_TO_SLUG.get(doctype)


def doctype_for(slug: str) -> str | None:
	return SLUG_TO_DOCTYPE.get(slug)

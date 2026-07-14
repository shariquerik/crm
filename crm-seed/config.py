"""Single source of truth for the CRM-on-Studio app's identity and its doctype map.

Per docs/adr/0003, these seed scripts are the source of truth for the Studio app;
the JSON exported under apps/crm/studio/ is a generated artifact.
"""

APP_NAME = "crm-studio"  # Studio App docname (app_name is the naming key)
APP_TITLE = "CRM on Studio"
APP_ROUTE = "crm-studio"  # served at /crm-studio/... ; /crm belongs to CRM's own frontend
FRAPPE_APP = "crm"  # standard-app export target -> apps/crm/studio/<APP_NAME>/


# --- the doctype in the route -----------------------------------------------
# The Generic List Page (ADR-0002) is ONE page at `/:doctype`, and that param is the
# REAL doctype name — `/crm-studio/CRM Lead`, not a slug. This is deliberate and it is
# what makes the page work for every doctype:
#
#   A slug ("crm-lead") is lossy — you cannot get back to "CRM Lead" (vs "Crm Lead")
#   without a lookup table, and only the server knows the real names. That table would
#   have to be baked into the page, which caps the app at whatever doctypes were known
#   at seed time. Carrying the name itself needs NO table: `route.params.doctype` IS
#   the doctype, so any doctype the user can read just works, forever.
#
# The space is URL-encoded on the wire (/crm-studio/CRM%20Lead) and vue-router decodes
# it back into the param, so pages read a clean "CRM Lead". Links are built with
# encodeURIComponent — see the page scripts.
#
# So there is no slug map anywhere. DOCTYPES below is a much smaller thing: purely the
# doctypes that get a labelled, iconed row in the SIDEBAR. A doctype outside this list
# is still fully reachable by URL — it just isn't advertised in the nav.

DOCTYPES = [
	{"doctype": "CRM Lead", "label": "Leads", "icon": "user-plus"},
	{"doctype": "CRM Deal", "label": "Deals", "icon": "briefcase"},
	{"doctype": "Contact", "label": "Contacts", "icon": "users"},
	{"doctype": "CRM Organization", "label": "Organizations", "icon": "home"},
	{"doctype": "CRM Task", "label": "Tasks", "icon": "check-square"},
	{"doctype": "FCRM Note", "label": "Notes", "icon": "edit"},
]

# doctype -> the nicer plural the sidebar and the detail breadcrumb show ("Leads").
# Only the curated ones have one; everything else is shown as its own doctype name,
# which is the fallback the pages apply.
DOCTYPE_LABELS = {d["doctype"]: d["label"] for d in DOCTYPES}

# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from crm.navigation.rail import seed_rail
from crm.saved_views.migrate import migrate_crm_view_settings
from crm.saved_views.seed import seed_saved_views


def execute():
	"""Give an existing site the navigation a fresh install gets from `after_install`,
	and carry its CRM View Settings over to Saved Views."""
	seed_saved_views()
	seed_rail()
	migrate_crm_view_settings()

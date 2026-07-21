from crm.saved_views.migrate import migrate_crm_view_settings
from crm.saved_views.seed import seed_saved_views


def execute():
	seed_saved_views()
	migrate_crm_view_settings()

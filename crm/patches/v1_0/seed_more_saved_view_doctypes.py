from crm.saved_views.seed import seed_saved_views


def execute():
	"""Seed the Contact, Organization, Task, and Note sidebars, which joined the seeder
	after `seed_and_migrate_saved_views` had already run on existing sites. Idempotent:
	`seed_saved_views` gates on each section, so Deals and Leads are left untouched and
	nothing a manager deleted is resurrected."""
	seed_saved_views()

from crm.navigation.rail import seed_rail


def execute():
	"""Give an existing site the app-level section the rail now reads from, which only
	a fresh install would otherwise get.

	Seeded, not migrated: the rail's own storage is a JSON blob nothing points at, so
	there is no placement to preserve. It is left in place for ticket 10 to retire."""
	seed_rail()

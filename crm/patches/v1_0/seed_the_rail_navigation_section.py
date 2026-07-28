from crm.navigation.rail import seed_rail


def execute():
	"""Give an existing site the app-level section the rail now reads from, which only
	a fresh install would otherwise get.
	"""
	seed_rail()

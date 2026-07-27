# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

import frappe


def execute():
	"""Drop the rail's per-user storage. It now reads Navigation Sections, the same
	model the sidebar reads, and a personal "App Sidebar" blob is a JSON delta nothing
	else points at — so it is dropped rather than migrated, and its owner rearranges.

	The shared record stays: it is a fixture, resynced on every migrate, and the seed
	that gave this site its rail was taken from it.
	"""
	frappe.db.delete("CRM UI Customization", {"type": "App Sidebar", "user": ("is", "set")})

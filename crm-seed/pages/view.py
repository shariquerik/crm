"""The saved-view page at `/:doctype/view/:viewName` — the list screen, with a stored
`CRM View Settings` row loaded into its controls (CONTEXT.md, "Saved view").

It is a separate Studio PAGE only because Studio resolves a page by its route PATTERN
(AppContainer looks up `route.matched[0].path`), so a URL segment cannot be optional — one
page is one pattern. It is not a separate SCREEN: pages/list.py's build_page() builds both,
so there is one block tree, one script and one set of variables (ADR-0002's single generic
list page). The only differences are what a route can't otherwise carry into a Studio page:
the `currentView` resource, and the list resource's `auto` flag.

Routing: the detail page at `/:doctype/:id` cannot shadow this. It has two path segments,
so it can never match a three-segment URL — and vue-router ranks a static segment ("view")
above a param anyway. Registration order (which is whatever `frappe.get_all("Studio Page")`
returns, not something a seed controls) is therefore not load-bearing.
"""

from pages.list import build_page

PAGE_NAME = "crm-view"


def build() -> dict:
	# page_title must be unique among published pages, like the route.
	return build_page(PAGE_NAME, page_title="Saved View", route="/:doctype/view/:viewName", saved_view=True)

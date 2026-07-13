"""CRMSidebar — the app's navigation sidebar, as ONE Studio Component (CONTEXT.md).

The component is a pure renderer: it takes the `CRM UI Customization` "App Sidebar" layout
as an input and renders it inside frappe-ui's `Sidebar`. Its content is DATA (PR 1524's
design), never hardcoded sections; wrapping Sidebar is what lets the shell be swapped
later. One block tree, referenced by every page.

Three things the pages have to supply, because a Studio Component's block tree cannot
declare them itself:

  * RESOURCE   — resources live on the PAGE, not on a component. Each page declares the
                 same `sidebarLayout` API Resource and passes `sidebarLayout.data` in as
                 the `sections` input. The block tree stays in this one file; a shared
                 resource row per page is not a duplicated component.
  * VARIABLES  — `sidebarCollapsed`, the Sidebar's `collapsed` v-model, and `views`, the
                 saved views the doctype rows hang under. A prop bound with
                 blocks.bind() inside a component still reads and writes the PAGE's
                 variable (codeStore.getValueFromVariable/setValueInVariable fall through
                 to `variables` — the component's own context only adds `inputs`), so the
                 two-way binding works across the component boundary.
  * PAGE_SETUP — Studio remounts the page, and with it this component, on every
                 navigation, so a variable cannot carry the collapsed state across a
                 route change. localStorage does; the snippet rehydrates the variable on
                 setup and persists every toggle. It also fetches the saved views into
                 the `views` variable — a component cannot declare a resource, and every
                 page shows the sidebar, so the fetch belongs to the snippet every page
                 splices in.

Sidebar is used through its COMPOSITION api (the shell owns the collapse state, the width
and the transition; we own the body), not its deprecated `sections` config prop. That is
forced, not preferred: SidebarItem reads `if (props.active !== undefined) return props.active`,
but `active` is a Boolean prop, and Vue casts an absent Boolean prop to `false` — so
`active` is never `undefined`, and `isActive` and the built-in route matching below it are
both dead code. Every config-driven row renders `data-state="inactive"` (verified in the
browser). frappe-ui's SidebarItem needs `active: { type: Boolean, default: undefined }`,
or the guard rewritten as `props.active != null`.

So the rows are Studio blocks (Repeater + container + FeatherIcon + TextBlock) inside
Sidebar's default slot. SidebarItem / SidebarLabel / SidebarCollapseToggle aren't
registered in Studio anyway (only `Sidebar` is), so they could not have been used as
blocks even without the bug — the collapse toggle at the bottom is ours too.
"""

import json

import blocks
import config

COMPONENT_ID = "crm-sidebar"  # the Studio Component DOCNAME — pages reference this
COMPONENT_NAME = "CRMSidebar"

RESOURCE_NAME = "sidebarLayout"
COLLAPSE_VARIABLE = "sidebarCollapsed"
COLLAPSE_KEY = "crm-studio:sidebar-collapsed"
VIEWS_VARIABLE = "views"

SECTIONS_INPUT = "sections"
ACTIVE_SLUG_INPUT = "activeSlug"
VIEWS_INPUT = "views"

# The sidebar's content is DATA (PR 1524's design), not code: whatever
# ui_customization.py wrote into the "App Sidebar" record is what renders.
RESOURCE = {
	"resource_name": RESOURCE_NAME,
	"resource_type": "API Resource",
	"url": "crm.fcrm.doctype.crm_ui_customization.crm_ui_customization.get_sidebar_layout",
	"method": "GET",
	"auto": 1,
	"params": json.dumps({}),
	"transform": "",
}

VARIABLES = [
	{"variable_name": COLLAPSE_VARIABLE, "variable_type": "Boolean", "initial_value": False},
	# The saved views of every doctype, grouped by doctype. Filled by PAGE_SETUP below, read
	# by this component (the rows under a doctype) and by the list page's view picker.
	{"variable_name": VIEWS_VARIABLE, "variable_type": "Object", "initial_value": {}},
]

# Spliced into every page's setup(). `watch` must already be imported from "vue".
PAGE_SETUP = f"""
	// The sidebar's collapsed state has to outlive the page: Studio remounts the page (and
	// the CRMSidebar component with it) on every navigation, so the `{COLLAPSE_VARIABLE}`
	// variable backing Sidebar's `collapsed` v-model resets. localStorage is the only place
	// it can survive — rehydrate it here, persist it on every toggle.
	const {{ {COLLAPSE_VARIABLE} }} = ctx
	{COLLAPSE_VARIABLE}.value = localStorage.getItem("{COLLAPSE_KEY}") === "true"
	watch({COLLAPSE_VARIABLE}, (collapsed: boolean) => {{
		localStorage.setItem("{COLLAPSE_KEY}", collapsed ? "true" : "false")
	}})

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `{VIEWS_VARIABLE}` variable the
	// component renders. The list page's view picker reads the same variable: one fetch, one
	// source of truth. The call goes through `ctx.call` (Studio puts frappe-ui's `call` in
	// every script's context) rather than an import, because the pages' scripts share no set
	// of static imports — the home page imports nothing from frappe-ui.
	const {{ {VIEWS_VARIABLE} }} = ctx
	const VIEW_SLUGS: Record<string, string> = {json.dumps(config.DOCTYPE_TO_SLUG)}
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {{
		// Grouped by doctype, and carrying the slug: both the sidebar row and the picker
		// route by slug (`/:doctype/view/:viewName`), and a stored view only knows its `dt`.
		const grouped: Record<string, any[]> = {{}}
		for (const row of rows || []) {{
			const slug = VIEW_SLUGS[row.dt]
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!slug || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), {{ ...row, slug }}]
		}}
		{VIEWS_VARIABLE}.value = grouped
	}})
""".rstrip()


ACTIVE_BG = "#e5e7eb"
ACTIVE_TEXT = "#171717"
MUTED_TEXT = "#525252"

INPUTS = [
	{
		"input_name": SECTIONS_INPUT,
		"type": "Object",
		"description": "The CRM UI Customization 'App Sidebar' layout, as get_sidebar_layout returns it.",
		"required": 1,
	},
	{
		"input_name": ACTIVE_SLUG_INPUT,
		"type": "String",
		"description": "The doctype slug of the current route; its entry is highlighted.",
		"required": 0,
	},
	{
		"input_name": VIEWS_INPUT,
		"type": "Object",
		"description": "Saved views grouped by doctype, as PAGE_SETUP's fetch leaves them.",
		"required": 0,
	},
]

# Row height/padding are duplicated between an entry and the collapse toggle, so both read
# the same shape whichever state the sidebar is in.
ROW = {
	"flexDirection": "row",
	"alignItems": "center",
	"gap": "8px",
	"height": "28px",
	"paddingLeft": "8px",
	"paddingRight": "8px",
	"borderRadius": "6px",
	"cursor": "pointer",
	"flexShrink": "0",
	# collapsed, the sidebar is a 3.5rem rail: the icon centres, the label is gone
	"justifyContent": f"{{{{ {COLLAPSE_VARIABLE} ? 'center' : 'flex-start' }}}}",
}

LABEL = {"fontSize": "13px", "whiteSpace": "nowrap", "overflow": "hidden"}


def _icon(component_id: str, name: str) -> dict:
	# FeatherIcon is always in the bundle (studio.constants.DEFAULT_COMPONENTS) and takes a
	# plain string, so the layout record's icon names travel straight through as data.
	return blocks.block(
		"FeatherIcon",
		component_id,
		props={"name": name},
		styles={"width": "16px", "height": "16px", "flexShrink": "0", "color": MUTED_TEXT},
	)


def _entry() -> dict:
	"""One doctype row. Inside the items Repeater, so `dataItem` is one layout item."""
	return blocks.container(
		"crm-sidebar-entry",
		styles={
			**ROW,
			"width": "100%",
			# The active highlight. It cannot come from the item's route: every doctype URL
			# resolves to the SAME named route (the Generic List Page), so route matching
			# would light up every row — the page passes the slug it is showing instead, and
			# the detail page passes its parent's, so a record keeps its list lit.
			"backgroundColor": f"{{{{ dataItem.slug === inputs.{ACTIVE_SLUG_INPUT} ? '{ACTIVE_BG}' : 'transparent' }}}}",
		},
		# The Generic List Page is `/:doctype`, so an item's slug IS its list route.
		events={"click": blocks.event("click", "function handleEvent() { router.push('/' + dataItem.slug) }")},
		children=[
			_icon("crm-sidebar-entry-icon", "{{ dataItem.icon }}"),
			blocks.block(
				"TextBlock",
				"crm-sidebar-entry-label",
				props={"text": "{{ dataItem.label }}"},
				styles={
					**LABEL,
					"color": f"{{{{ dataItem.slug === inputs.{ACTIVE_SLUG_INPUT} ? '{ACTIVE_TEXT}' : '{MUTED_TEXT}' }}}}",
				},
				visibility=f"{{{{ !{COLLAPSE_VARIABLE} }}}}",
			),
		],
	)


def _view_row() -> dict:
	"""One saved view, under its doctype. Inside the views Repeater, so `dataItem` is a view
	row — `slug` included, which PAGE_SETUP adds because a stored view only knows its `dt`."""
	# The view page is /:doctype/view/:viewName, and CRM View Settings is autoincrement, so
	# its `name` is an INT while the route param is a string.
	is_active = f"String(dataItem.name) === route.params.viewName"
	return blocks.container(
		"crm-sidebar-view",
		styles={
			**ROW,
			"width": "100%",
			"paddingLeft": "28px",
			"backgroundColor": f"{{{{ {is_active} ? '{ACTIVE_BG}' : 'transparent' }}}}",
		},
		events={
			"click": blocks.event(
				"click",
				"function handleEvent() { router.push('/' + dataItem.slug + '/view/' + dataItem.name) }",
			)
		},
		children=[
			blocks.block(
				"TextBlock",
				"crm-sidebar-view-label",
				props={"text": "{{ dataItem.label }}"},
				styles={
					**LABEL,
					"color": f"{{{{ {is_active} ? '{ACTIVE_TEXT}' : '{MUTED_TEXT}' }}}}",
				},
			),
		],
	)


def _item() -> dict:
	"""One doctype: its row, and the saved views hanging under it (PR 1524's shape). The
	views Repeater is a SIBLING of the row, not a child of it — nested inside, every click on
	a view would bubble into the row's handler and navigate to the list instead."""
	return blocks.container(
		"crm-sidebar-item",
		styles={"gap": "2px", "width": "100%"},
		children=[
			_entry(),
			blocks.block(
				"Repeater",
				"crm-sidebar-views",
				# `dataItem` is still the doctype item in this scope; the views variable is
				# keyed by doctype, so no client-side filtering is needed here.
				props={
					"data": f"{{{{ inputs.{VIEWS_INPUT}[dataItem.dt] || [] }}}}",
					"dataKey": "name",
					"emptyStateMessage": " ",
				},
				styles={"flexDirection": "column", "gap": "2px", "width": "100%"},
				# collapsed, the sidebar is a 3.5rem rail — a label-only row has nothing to show
				visibility=f"{{{{ !{COLLAPSE_VARIABLE} }}}}",
				children=[_view_row()],
			),
		],
	)


def _section() -> dict:
	"""One layout section: its label, then its items. `dataItem` is the section here; the
	inner Repeater's `data` is still evaluated in THIS scope, so it reads dataItem.items."""
	return blocks.container(
		"crm-sidebar-section",
		styles={"gap": "2px", "width": "100%"},
		children=[
			blocks.block(
				"TextBlock",
				"crm-sidebar-section-label",
				props={"text": "{{ dataItem.label }}"},
				styles={
					"fontSize": "11px",
					"fontWeight": "500",
					"color": MUTED_TEXT,
					"paddingLeft": "8px",
					"marginBottom": "2px",
				},
				visibility=f"{{{{ !{COLLAPSE_VARIABLE} }}}}",
			),
			blocks.block(
				"Repeater",
				"crm-sidebar-entries",
				props={"data": "{{ dataItem.items || [] }}", "dataKey": "slug", "emptyStateMessage": " "},
				# Repeater's own root is `flex flex-row flex-wrap gap-5`; inline styles win.
				styles={"flexDirection": "column", "gap": "2px", "width": "100%"},
				children=[_item()],
			),
		],
	)


def _toggle() -> dict:
	"""Our own collapse toggle: SidebarCollapseToggle only renders on Sidebar's deprecated
	config path, and it isn't registered in Studio either."""
	return blocks.container(
		"crm-sidebar-toggle",
		styles={**ROW, "width": "100%", "marginTop": "auto"},
		events={
			"click": blocks.event(
				"click",
				# page variables reach an event script as refs (codeStore.scriptContext)
				f"function handleEvent() {{ {COLLAPSE_VARIABLE}.value = !{COLLAPSE_VARIABLE}.value }}",
			)
		},
		children=[
			_icon("crm-sidebar-toggle-icon", "sidebar"),
			blocks.block(
				"TextBlock",
				"crm-sidebar-toggle-label",
				props={"text": "Collapse"},
				styles={**LABEL, "color": MUTED_TEXT},
				visibility=f"{{{{ !{COLLAPSE_VARIABLE} }}}}",
			),
		],
	)


def build() -> dict:
	return {
		"component_name": COMPONENT_NAME,
		"inputs": INPUTS,
		# A component's `block` is a SINGLE block, so Sidebar itself is the root; giving it
		# children puts them in its default slot, which is what selects the composition path.
		"block": blocks.block(
			"Sidebar",
			"crm-sidebar-root",
			props={
				"width": "15rem",
				"collapsedWidth": "3.5rem",
				# Sidebar's `collapsed` is a defineModel, so this is a real two-way binding:
				# Studio reads the PAGE's variable for the prop and writes every change back
				# into it — which is what the page script then persists to localStorage.
				"collapsed": blocks.bind(COLLAPSE_VARIABLE),
			},
			children=[
				blocks.container(
					"crm-sidebar-body",
					styles={"height": "100%", "padding": "8px", "gap": "12px"},
					children=[
						blocks.block(
							"TextBlock",
							"crm-sidebar-title",
							props={"text": "CRM on Studio"},
							styles={
								"fontSize": "14px",
								"fontWeight": "600",
								"paddingLeft": "8px",
								"whiteSpace": "nowrap",
								"overflow": "hidden",
							},
							visibility=f"{{{{ !{COLLAPSE_VARIABLE} }}}}",
						),
						blocks.block(
							"Repeater",
							"crm-sidebar-sections",
							props={
								"data": f"{{{{ inputs.{SECTIONS_INPUT} || [] }}}}",
								"dataKey": "name",
								"emptyStateMessage": " ",
							},
							styles={"flexDirection": "column", "gap": "12px", "width": "100%"},
							children=[_section()],
						),
						_toggle(),
					],
				)
			],
		),
	}


def instance(active_slug: str = "") -> dict:
	"""The block a page drops into its root to place the sidebar.

	`active_slug` is a page expression (the list/detail pages have a `:doctype` param;
	the home page has none).
	"""
	return blocks.studio_component(
		component_id_ref=COMPONENT_ID,
		instance_id="crm-sidebar",
		props={
			SECTIONS_INPUT: f"{{{{ {RESOURCE_NAME}.data || [] }}}}",
			ACTIVE_SLUG_INPUT: active_slug,
			# no `|| {}` fallback: an expression's `}}` would close the interpolation early.
			# The variable's initial value is already an empty object.
			VIEWS_INPUT: f"{{{{ {VIEWS_VARIABLE} }}}}",
		},
	)

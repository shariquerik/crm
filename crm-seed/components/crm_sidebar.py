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
and the transition; we own the body), not its deprecated `header`/`sections` config props —
passing default-slot children disables those anyway. The body is built from frappe-ui's own
SidebarHeader / SidebarLabel / SidebarItem / SidebarCollapseToggle, so the rows get the
library's chrome (28px rounded rows, the raised active pill, the collapse transitions)
instead of a hand-rolled imitation.

Two things that shape how those components are used here:

  * ACTIVE   — every row passes `active` EXPLICITLY. SidebarItem's built-in route matching
               is dead code: it guards with `if (props.active !== undefined)`, but `active`
               is a Boolean prop and Vue casts an absent Boolean to `false`, so the guard
               always wins. Passing `active` ourselves is the supported path and is what we
               need regardless — every doctype URL resolves to the SAME named route (the
               Generic List Page), so route matching would light up every row. The page
               passes the doctype it is showing, and the detail page passes its parent's,
               so a record keeps its list lit.
  * ICONS    — the icon rides in SidebarItem's `#prefix` slot as a FeatherIcon, not in its
               `icon` prop. The prop takes a component or a `lucide-*` CSS class, and those
               classes are real — but frappe-ui's tailwind lucideIconsPlugin only emits the
               ones Tailwind can see in the SOURCE at build time (164 of them in this app's
               bundle; `lucide-building-2` and `lucide-square-pen` are already missing). Our
               icon names come out of the layout record at RUNTIME, so a `lucide-<name>`
               class would work for some rows and silently render an empty span for others.
               FeatherIcon is always in the bundle (studio.constants.DEFAULT_COMPONENTS) and
               takes a plain string, so the layout record's icon names travel through as data.

Rows navigate from a click handler rather than SidebarItem's `to` prop: `to` renders a
RouterLink, which resolves its target at render time against whatever router is mounted —
in the Studio BUILDER that is the builder's own router, which has no `/leads` route.
"""

import json

import blocks

COMPONENT_ID = "crm-sidebar"  # the Studio Component DOCNAME — pages reference this
COMPONENT_NAME = "CRMSidebar"

RESOURCE_NAME = "sidebarLayout"
COLLAPSE_VARIABLE = "sidebarCollapsed"
COLLAPSE_KEY = "crm-studio:sidebar-collapsed"
VIEWS_VARIABLE = "views"

SECTIONS_INPUT = "sections"
ACTIVE_DOCTYPE_INPUT = "activeDoctype"
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
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {{
		// Grouped by the doctype they belong to — which is also all a row needs to build its
		// URL, since the route carries the doctype name itself (`/:doctype/view/:viewName`).
		// So a view on ANY doctype routes correctly, not just the six the sidebar advertises.
		const grouped: Record<string, any[]> = {{}}
		for (const row of rows || []) {{
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!row.dt || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), row]
		}}
		{VIEWS_VARIABLE}.value = grouped
	}})
""".rstrip()


# SidebarItem paints the row itself (active pill, hover, muted label); the only colour left
# to us is the FeatherIcon in its #prefix slot, matching SidebarItemIcon's text-ink-gray-6.
MUTED_TEXT = "#525252"

INPUTS = [
	{
		"input_name": SECTIONS_INPUT,
		"type": "Object",
		"description": "The CRM UI Customization 'App Sidebar' layout, as get_sidebar_layout returns it.",
		"required": 1,
	},
	{
		"input_name": ACTIVE_DOCTYPE_INPUT,
		"type": "String",
		"description": "The doctype of the current route; its entry is highlighted.",
		"required": 0,
	},
	{
		"input_name": VIEWS_INPUT,
		"type": "Object",
		"description": "Saved views grouped by doctype, as PAGE_SETUP's fetch leaves them.",
		"required": 0,
	},
]

# SidebarItem's own link is `pl-2`, and an entry's label starts one icon (16px) plus one gap
# (8px) further in. A view row carries no icon, so it needs that 24px as padding to line its
# label up under its doctype's.
VIEW_INDENT = "24px"


def _icon(component_id: str, name: str) -> dict:
	return blocks.block(
		"FeatherIcon",
		component_id,
		props={"name": name},
		styles={"width": "16px", "height": "16px", "flexShrink": "0", "color": MUTED_TEXT},
	)


def _entry() -> dict:
	"""One doctype row. Inside the items Repeater, so `dataItem` is one layout item."""
	return blocks.block(
		"SidebarItem",
		"crm-sidebar-entry",
		props={
			"label": "{{ dataItem.label }}",
			"active": f"{{{{ dataItem.dt === inputs.{ACTIVE_DOCTYPE_INPUT} }}}}",
		},
		slots={"prefix": [_icon("crm-sidebar-entry-icon", "{{ dataItem.icon }}")]},
		# The Generic List Page is `/:doctype` and that param is the doctype NAME, so an
		# item's `dt` is its list route — encoded, because doctype names contain spaces.
		events={
			"click": blocks.event(
				"click",
				"function handleEvent() { router.push('/' + encodeURIComponent(dataItem.dt)) }",
			)
		},
	)


def _view_row() -> dict:
	"""One saved view, under its doctype. Inside the views Repeater, so `dataItem` is a view
	row, whose `dt` is the doctype — which is exactly what its URL needs."""
	# The view page is /:doctype/view/:viewName, and CRM View Settings is autoincrement, so
	# its `name` is an INT while the route param is a string.
	is_active = "String(dataItem.name) === route.params.viewName"
	return blocks.block(
		"SidebarItem",
		"crm-sidebar-view",
		props={"label": "{{ dataItem.label }}", "active": f"{{{{ {is_active} }}}}"},
		styles={"paddingLeft": VIEW_INDENT},
		events={
			"click": blocks.event(
				"click",
				"function handleEvent() { router.push('/' + encodeURIComponent(dataItem.dt) + '/view/' + dataItem.name) }",
			)
		},
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
				"SidebarLabel",
				"crm-sidebar-section-label",
				# SidebarLabel hides its own text when collapsed and shows a rule instead, so it
				# needs no visibility of ours — but an UNLABELLED section (the layout allows one)
				# would still reserve its 28px row, so skip the block entirely when there's no text.
				props={"divider": True},
				visibility="{{ dataItem.label }}",
				children=[
					blocks.block("TextBlock", "crm-sidebar-section-label-text", props={"text": "{{ dataItem.label }}"})
				],
			),
			blocks.block(
				"Repeater",
				"crm-sidebar-entries",
				props={"data": "{{ dataItem.items || [] }}", "dataKey": "dt", "emptyStateMessage": " "},
				# Repeater's own root is `flex flex-row flex-wrap gap-5`; inline styles win.
				styles={"flexDirection": "column", "gap": "2px", "width": "100%"},
				children=[_item()],
			),
		],
	)


def _toggle() -> dict:
	"""The collapse toggle. No props and no click handler of its own: it reads Sidebar's
	collapsed state and its toggle through provide/inject, and Sidebar's `toggle()` writes
	through the `collapsed` defineModel — which is bound to our page variable, so the page
	script still sees every change and persists it."""
	return blocks.block("SidebarCollapseToggle", "crm-sidebar-toggle", styles={"marginTop": "auto"})


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
				# Sidebar's default slot is bare — no padding, and (unlike its legacy config path)
				# no right border. The body owns both.
				blocks.container(
					"crm-sidebar-body",
					styles={"height": "100%", "padding": "8px", "gap": "4px"},
					children=[
						# `title` is SidebarHeader's only required prop; with no `logo` it renders
						# the title's first letter in a rounded box, which is the shell we want.
						blocks.block("SidebarHeader", "crm-sidebar-title", props={"title": "CRM on Studio"}),
						blocks.block(
							"Repeater",
							"crm-sidebar-sections",
							props={
								"data": f"{{{{ inputs.{SECTIONS_INPUT} || [] }}}}",
								"dataKey": "name",
								"emptyStateMessage": " ",
							},
							# The rows scroll; the toggle below stays pinned to the bottom.
							styles={
								"flexDirection": "column",
								"gap": "12px",
								"width": "100%",
								"flexGrow": "1",
								"overflowY": "auto",
								"overflowX": "hidden",
							},
							children=[_section()],
						),
						_toggle(),
					],
				)
			],
		),
	}


def instance(active_doctype: str = "") -> dict:
	"""The block a page drops into its root to place the sidebar.

	`active_doctype` is a page expression (the list/detail pages have a `:doctype` param,
	which IS the doctype name; the home page has none).
	"""
	return blocks.studio_component(
		component_id_ref=COMPONENT_ID,
		instance_id="crm-sidebar",
		props={
			SECTIONS_INPUT: f"{{{{ {RESOURCE_NAME}.data || [] }}}}",
			ACTIVE_DOCTYPE_INPUT: active_doctype,
			# no `|| {}` fallback: an expression's `}}` would close the interpolation early.
			# The variable's initial value is already an empty object.
			VIEWS_INPUT: f"{{{{ {VIEWS_VARIABLE} }}}}",
		},
	)

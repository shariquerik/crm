"""The Generic List Page at `/:doctype` (ADR-0002) — one page for every doctype.

The URL slug is mapped to a real doctype through the `doctypeMap` variable, which is
built from config.DOCTYPES (the one place that mapping lives). Rows and columns both
come straight out of `crm.api.doc.get_data`, so nothing here is per-doctype.

The toolbar holds @framework/ui's four list controls — Filter, SortBy, QuickFilter,
ColumnSettings: controlled, meta-driven controls that hold no data of their own. Their
v-models are the page variables `filters`, `sort` and `columns`, in the controls' NATIVE
shapes (FilterCondition[] / Sort[] / Column[], ADR-0001); the page script translates
those to get_data's `filters` dict / `order_by` string / `columns` + `rows` and refetches.

Filter and QuickFilter bind the SAME `filters` variable (ui ADR-0005): both mutate one
array, so they stay in sync with no event plumbing — QuickFilter simply projects over
the conditions whose operator it owns.

This module builds TWO pages, because that state can also be SAVED (a `CRM View Settings`
row) and reopened at `/:doctype/view/:viewName` — the saved-view page, seeded by pages/
view.py, which is this same screen with the view's filters/sort/columns loaded into those
same variables. Same block tree, same script, same variables: `build_page()` is the one
builder, and the only differences are the `currentView` resource and the list resource's
`auto` (see build_page). One generic list screen, as ADR-0002 asks — not a copy.
"""

import json

import blocks
import config
from components import crm_sidebar

PAGE_NAME = "crm-list"

# get_data's `filters` is annotated `dict`, so it must reach the server as JSON —
# a GET would send it through URLSearchParams as "[object Object]" and Frappe would
# raise FrappeTypeError. Hence method POST (frappe-ui puts the params in the body).
LIST_RESOURCE = "listData"

# The saved view being shown, on the saved-view page only. get_current_view falls back to a
# meta-derived standard view when the name matches nothing, so a stale URL still renders.
VIEW_RESOURCE = "currentView"

PAGE_LENGTH = 20
DEFAULT_ORDER_BY = "modified desc"

# The picker's entry for the plain /:doctype route — the list as the doctype's meta defines
# it, with nothing saved.
DEFAULT_VIEW_LABEL = "Default view"

# Both controls read the doctype's Meta themselves, so the offered fields follow this
# one expression — no per-doctype config.
DOCTYPE_EXPR = "{{ doctypeMap[route.params.doctype] }}"

SCRIPT = f"""
// List page: the toolbar's four controls hold the narrowing, the ordering and the shown
// columns in @framework/ui's own shapes (FilterCondition[] / Sort[] / Column[]). Nothing
// else does — the controls never fetch. This script is the only place those shapes are
// translated into what `crm.api.doc.get_data` takes, and the only thing that refetches.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources
// by name, its variables as refs, and route/router. What it RETURNS is exposed to the
// block expressions ({{{{ wireColumns }}}}), which is how the table repaints the instant
// ColumnSettings changes, without waiting for the refetch.
import {{ computed, onScopeDispose, watch }} from "vue"
import {{ call }} from "frappe-ui"
// The controls ship the wire translation as pure helpers; the page script is compiled
// into the app bundle by studio's vite, which aliases @framework/ui — so reuse them
// rather than re-deriving the operator / column tables.
import {{ useDoctypeMeta }} from "@framework/ui"
import {{ getFilterableFields, parseFilters, serializeFilters }} from "@framework/ui/Filter"
import {{ parseOrderBy, serializeOrderBy }} from "@framework/ui/SortBy"
import {{ fetchFields, parseColumns, serializeColumns }} from "@framework/ui/ColumnSettings"

export default function setup(ctx: any) {{
	const {{ {LIST_RESOURCE}, filters, sort, columns, doctypeMap, route, router }} = ctx
	// `{crm_sidebar.VIEWS_VARIABLE}` is not destructured here — the sidebar's snippet below already declares it
	// (it owns the fetch), and this script shares that one scope.
	const {{ viewDialog, newViewLabel }} = ctx
	const doctype = doctypeMap.value[route.params.doctype]
	// Only the saved-view page declares this resource, and only it has a :viewName.
	const {VIEW_RESOURCE} = ctx.{VIEW_RESOURCE}
	const viewName = route.params.viewName
{crm_sidebar.PAGE_SETUP}

	// Meta is fetched once per doctype and shared with the controls (same memoised
	// composable). Two translations need it: Column[] -> wire columns, and the URL's
	// wire filters -> FilterCondition[] (which carry their field's Meta).
	const {{ meta }} = useDoctypeMeta(doctype)
	const metaFields = computed(() => meta.value?.fields ?? [])

	// ColumnSettings speaks Column[] (`fieldname`, label, width?); get_data and the
	// ListView both speak the wire shape (`key`, label, width, type, align) — hence
	// serializeColumns, whose `type`/`align` come from Meta and are never stored on a
	// Column. Empty until the defaults are seeded (below), which is what keeps the
	// params identical to the resource's creation params until then.
	const modelColumns = computed(() =>
		(columns.value || []).length ? serializeColumns(columns.value, metaFields.value) : [],
	)

	// What the table renders: the control's columns, with the response's own standing in
	// for the frame before they're seeded, so the table is never column-less.
	const wireColumns = computed(
		() => (modelColumns.value.length ? modelColumns.value : {LIST_RESOURCE}.data?.columns) || [],
	)

	// get_data's `filters` is a DICT, so it holds one condition per field: the
	// [fieldname, operator, value] triples serializeFilters returns collapse to
	// {{fieldname: [operator, value]}} and a second condition on the same field wins.
	// (Different fields combine as AND, which is what the toolbar shows.)
	function toFiltersDict(conditions: any[]) {{
		const dict: Record<string, [string, unknown]> = {{}}
		for (const [fieldname, operator, value] of serializeFilters(conditions)) {{
			dict[fieldname] = [operator, value]
		}}
		return dict
	}}

	// A row the user added but hasn't filled in yet (a fresh `like` with no text, a Date
	// `between` with no range) is not a narrowing: sending it would match nothing (LIKE
	// "%%" drops NULLs) or make get_list throw on a null value.
	function isComplete(condition: any) {{
		const value = condition?.value
		if (value === null || value === undefined || value === "") return false
		if (Array.isArray(value) && !value.length) return false
		return true
	}}

	function listParams() {{
		const wire = modelColumns.value
		const params: Record<string, unknown> = {{
			doctype,
			filters: toFiltersDict((filters.value || []).filter(isComplete)),
			// Clearing every sort rule leaves order_by empty; get_data requires a string.
			order_by: serializeOrderBy(sort.value || []) || "{DEFAULT_ORDER_BY}",
			page_length: {PAGE_LENGTH},
			page_length_count: {PAGE_LENGTH},
		}}
		// Any non-empty `columns`/`rows` makes get_data a "custom view" that returns
		// exactly what it was asked for — so they are sent only once the columns are
		// known, and never as an empty pair (which would still trip the custom-view
		// branch and collapse the table to `name`). `rows` is the field set actually
		// fetched, so every column's key must be in it: that is fetchFields.
		if (wire.length) {{
			params.columns = wire
			params.rows = fetchFields(wire)
		}}
		return params
	}}

	// Resource params are evaluated ONCE, at resource creation, so a `{{{{ filters }}}}`
	// bound into them would never re-evaluate. The refetch is driven from here instead:
	// createResource's submit(params) replaces the resource's params and re-runs the call
	// (fetch/reload/submit are the same function; only the argument makes it re-send).
	// Debounced because a filter's value box emits on every keystroke, and skipped when the
	// wire params didn't actually change — adding an empty filter row, or picking a field
	// that leaves the condition incomplete, must not re-hit the server.
	let sent = JSON.stringify(listParams())
	let timer: ReturnType<typeof setTimeout> | undefined
	watch(
		[filters, sort, columns],
		() => {{
			clearTimeout(timer)
			timer = setTimeout(() => {{
				const params = listParams()
				const encoded = JSON.stringify(params)
				if (encoded === sent) return
				sent = encoded
				{LIST_RESOURCE}.submit(params)
			}}, 250)
		}},
		{{ deep: true }},
	)
	onScopeDispose(() => clearTimeout(timer))

	// The ColumnSettings model starts empty and the control holds no defaults (ui
	// ADR-0006): the HOST owns them, and the doctype's defaults are exactly what the
	// first (default-view) response came back with. Seed them once, in Column[] shape.
	// Meta has to be in before seeding: serializeColumns derives `type`/`align` from it,
	// so seeding earlier would leave `sent` describing meta-less columns, and Meta landing
	// a moment later would look like a real change and refire the fetch.
	let seeded = false
	watch(
		[() => {LIST_RESOURCE}.data?.columns, metaFields],
		([wire, fields]: [any[], any[]]) => {{
			if (seeded || !wire?.length || !fields.length) return
			seeded = true
			// The server just returned these columns, so echoing them back is a no-op
			// fetch: adopt them into `sent` instead of firing one. Unless something else
			// (a URL filter) already moved the params — then the pending submit must
			// still go out, now carrying the columns too, so `sent` is left alone.
			const unchanged = JSON.stringify(listParams()) === sent
			columns.value = parseColumns(wire)
			if (unchanged) sent = JSON.stringify(listParams())
		}},
		{{ immediate: true }},
	)

	// The inverse of toFiltersDict + serializeFilters: wire conditions back into the
	// FilterCondition[] the controls render. parseFilters drops any field absent from Meta,
	// and keeps a LIKE's value verbatim. Our conditions store a `like` value BARE (ui
	// ADR-0005) — serializeFilters re-wraps the %% — so unwrap a fully-wrapped one, else the
	// input would read "%A%" and a re-serialize would double-wrap. A one-sided wildcard
	// ("A%") is a deliberate prefix search and is left alone.
	function toConditions(fields: any[], wire: [string, string, unknown][]) {{
		return parseFilters(getFilterableFields(fields, doctype), wire).map((c: any) => {{
			const value = c.value
			const wrapped =
				typeof value === "string" &&
				c.operator.includes("like") &&
				value.length > 1 &&
				value.startsWith("%") &&
				value.endsWith("%")
			return wrapped ? {{ ...c, value: value.slice(1, -1) }} : c
		}})
	}}

	// URL filters (the format PR frappe/crm#1524 uses): one query param per fieldname
	// whose value is a JSON [operator, value] pair, e.g. ?name=["LIKE","%A%"]. They are
	// written into the `filters` VARIABLE, not the resource — so the controls display
	// them and the watch above does the fetching. Deliberately one-way: filter changes
	// are not pushed back into the URL, both because the ticket doesn't ask for it and
	// because Studio re-runs a page's setup on `route.path` (not query) changes, so a
	// self-inflicted query churn would be silently ignored anyway.
	function urlConditions(fields: any[]) {{
		const wire: [string, string, unknown][] = []
		for (const [fieldname, raw] of Object.entries(route.query || {{}})) {{
			if (typeof raw !== "string") continue
			try {{
				const pair = JSON.parse(raw)
				if (Array.isArray(pair) && pair.length === 2) wire.push([fieldname, pair[0], pair[1]])
			}} catch {{
				// not a filter param (?view=..., ?page=...) — ignore it
			}}
		}}
		return toConditions(fields, wire)
	}}

	let urlApplied = false
	watch(
		metaFields,
		(fields: any[]) => {{
			if (urlApplied || !fields.length) return
			urlApplied = true
			const conditions = urlConditions(fields)
			if (conditions.length) filters.value = conditions
		}},
		{{ immediate: true }},
	)

	// --- saved views ---------------------------------------------------------------
	// A stored view holds get_data's WIRE shapes: a `filters` dict, an `order_by` string and
	// wire `columns`. get_data does NOT expand a view — passing a view name only affects
	// is_default — so a view is applied CLIENT-SIDE, exactly as CRM's own ViewControls does:
	// parse the row back into the controls' native shapes and let the existing watch refetch.
	// Parsing (rather than shoving the wire shapes at the resource) is what makes a view
	// VISIBLE in Filter/SortBy/ColumnSettings, not merely applied to the query.
	function applyView(view: any, fields: any[]) {{
		const wire: [string, string, unknown][] = []
		for (const [fieldname, condition] of Object.entries(JSON.parse(view.filters || "{{}}"))) {{
			// what we store, via toFiltersDict: {{fieldname: [operator, value]}}. CRM's own
			// frontend also writes a bare {{fieldname: value}}, which means equals.
			if (Array.isArray(condition) && condition.length === 2) {{
				wire.push([fieldname, condition[0] as string, condition[1]])
			}} else {{
				wire.push([fieldname, "=", condition])
			}}
		}}
		filters.value = toConditions(fields, wire)
		sort.value = parseOrderBy(view.order_by || "")

		const viewColumns = JSON.parse(view.columns || "[]")
		if (viewColumns.length) {{
			columns.value = parseColumns(viewColumns)
			// The view's columns ARE the defaults on this page — don't let the response's
			// columns seed over them.
			seeded = true
		}}

		// The list resource is auto=0 on the saved-view page (its creation params can't see
		// the view: they are evaluated once, against {{variables, route, router}}), so this is
		// the FIRST fetch, not a refetch — and the debounce watch above then sees the same
		// params and skips.
		const params = listParams()
		sent = JSON.stringify(params)
		{LIST_RESOURCE}.submit(params)
	}}

	if ({VIEW_RESOURCE}) {{
		let viewApplied = false
		// Meta has to be in too: a wire condition can't become a FilterCondition without the
		// field it carries.
		watch(
			[metaFields, () => {VIEW_RESOURCE}.data],
			([fields, view]: [any[], any]) => {{
				if (viewApplied || !fields.length || !view) return
				viewApplied = true
				applyView(view, fields)
			}},
			{{ immediate: true }},
		)
	}}

	// The picker. Its rows are the `{crm_sidebar.VIEWS_VARIABLE}` variable the sidebar's snippet fetched (grouped by
	// doctype) — one fetch feeds both the sidebar and this. Switching a view is a plain route
	// change: Studio re-runs the page's setup on every navigation, so the new view loads itself.
	const doctypeViews = computed(() => ({crm_sidebar.VIEWS_VARIABLE}.value || {{}})[doctype] || [])

	const viewLabel = computed(() => {{
		if (!viewName) return "{DEFAULT_VIEW_LABEL}"
		const row = doctypeViews.value.find((v: any) => String(v.name) === String(viewName))
		return row?.label || {VIEW_RESOURCE}?.data?.label || "View"
	}})

	const viewOptions = computed(() => [
		{{ label: "{DEFAULT_VIEW_LABEL}", onClick: () => router.push(`/${{route.params.doctype}}`) }},
		...doctypeViews.value.map((view: any) => ({{
			label: view.label,
			onClick: () => router.push(`/${{route.params.doctype}}/view/${{view.name}}`),
		}})),
	])

	// "Create view": the current control state, saved. listParams() is already exactly what a
	// view row stores (filters dict / order_by / columns / rows), so the state travels as-is.
	async function createView() {{
		const label = (newViewLabel.value || "").trim()
		if (!label) return
		const params = listParams() as any
		// create_or_update_view takes the view's doctype as `doctype` (NOT `dt`), and its JSON
		// fields as strings. With no `name` and no `is_standard` it routes to create().
		const view = await call(
			"crm.fcrm.doctype.crm_view_settings.crm_view_settings.create_or_update_view",
			{{
				view: {{
					label,
					type: "list",
					doctype,
					filters: JSON.stringify(params.filters || {{}}),
					order_by: params.order_by,
					columns: JSON.stringify(params.columns || []),
					rows: JSON.stringify(params.rows || []),
				}},
			}},
		)
		viewDialog.value = false
		newViewLabel.value = ""
		// CRM View Settings is autoincrement, so `name` is an int — the view's URL.
		router.push(`/${{route.params.doctype}}/view/${{view.name}}`)
	}}

	const createViewActions = computed(() => [
		{{
			label: "Create",
			variant: "solid",
			disabled: !(newViewLabel.value || "").trim(),
			onClick: createView,
		}},
	])

	// Exposed to the block expressions: the table renders `wireColumns`, not the response's
	// columns, so adding/removing a column repaints immediately (the matching refetch then
	// fills the new column's cells).
	return {{ wireColumns, viewLabel, viewOptions, createViewActions }}
}}
""".lstrip()


def build_page(page_name: str, page_title: str, route: str, saved_view: bool) -> dict:
	"""The list screen. `saved_view` builds the /:doctype/view/:viewName variant.

	Both pages are THIS tree, THIS script and THESE variables — the saved-view page differs
	only in the two things a route can't carry into a Studio page any other way:

	  * it declares the `currentView` resource (the view row, which the script parses back
	    into the controls' state);
	  * its list resource is auto=0, because a resource's params are evaluated ONCE, at
	    creation, against {variables, route, router} — they cannot see the view row, so an
	    auto fetch would fire the DEFAULT query and be immediately thrown away. The script
	    fires the one real fetch, once the view is in.
	"""
	# Controlled + meta-driven: `doctype` drives the offered fields, `modelValue` is the
	# default defineModel of each control — binding it to a variable makes Studio write
	# the control's `update:modelValue` straight back into that variable.
	filter_control = blocks.block(
		"Filter",
		"list-filter",
		props={"doctype": DOCTYPE_EXPR, "modelValue": blocks.bind("filters")},
	)

	sort_control = blocks.block(
		"SortBy",
		"list-sort",
		props={"doctype": DOCTYPE_EXPR, "modelValue": blocks.bind("sort")},
	)

	# ColumnSettings' default model is the ordered Column[]; the page script translates
	# it to the wire shape the table and get_data speak. It holds no defaults of its own
	# (ui ADR-0006) — the script seeds them from the first response, so no `canReset`.
	column_settings = blocks.block(
		"ColumnSettings",
		"list-columns",
		props={"doctype": DOCTYPE_EXPR, "modelValue": blocks.bind("columns")},
	)

	# QuickFilter has THREE named models and no default one: the prop to bind is
	# `filters` — pointed at the SAME variable the Filter popover binds. That single
	# shared array IS the sync (ui ADR-0005): a quick input projects over the conditions
	# whose operator it owns, so each control sees the other's edits with no plumbing.
	# `fields` is left unbound, so the surfaced inputs default to the doctype's Meta
	# (`in_standard_filter` fields, plus `name`).
	quick_filter = blocks.block(
		"QuickFilter",
		"list-quickfilter",
		props={"doctype": DOCTYPE_EXPR, "filters": blocks.bind("filters")},
		styles={"width": "100%"},
	)

	# The view picker. Its options are built in the page script (each one carries the
	# router.push that switches to it), so this is a pure renderer of `viewOptions`; the
	# button reads the view currently on screen.
	view_picker = blocks.block(
		"Dropdown",
		"list-view-picker",
		props={
			"options": "{{ viewOptions }}",
			"button": {
				"label": "{{ viewLabel }}",
				"variant": "subtle",
				"iconRight": "chevron-down",
			},
		},
	)

	create_view = blocks.block(
		"Button",
		"list-view-create",
		props={"label": "Save view", "variant": "subtle", "iconLeft": "plus"},
		events={"click": blocks.event("click", "function handleEvent() { viewDialog.value = true }")},
	)

	# The name prompt. frappe-ui's Dialog is `v-model`-driven and renders its children in the
	# default slot; its `actions` are objects with an onClick, so the Create button is built in
	# the page script (where createView lives) and bound as data.
	view_dialog = blocks.block(
		"Dialog",
		"list-view-dialog",
		props={
			"modelValue": blocks.bind("viewDialog"),
			"title": "Create view",
			"size": "sm",
			"actions": "{{ createViewActions }}",
		},
		children=[
			blocks.block(
				"TextInput",
				"list-view-name",
				props={
					"modelValue": blocks.bind("newViewLabel"),
					"placeholder": "e.g. Qualified leads",
					"size": "md",
				},
				styles={"width": "100%"},
			)
		],
	)

	toolbar = blocks.container(
		"list-toolbar",
		styles={
			"flexDirection": "row",
			"alignItems": "center",
			"justifyContent": "space-between",
			"gap": "8px",
		},
		children=[
			blocks.container(
				"list-heading",
				styles={
					"flexDirection": "row",
					"alignItems": "center",
					"gap": "8px",
					"width": "auto",
				},
				children=[
					blocks.block(
						"TextBlock",
						"list-title",
						props={"text": DOCTYPE_EXPR},
						styles={"fontSize": "20px", "fontWeight": "600"},
					),
					view_picker,
				],
			),
			blocks.container(
				"list-controls",
				styles={
					"flexDirection": "row",
					"alignItems": "center",
					"gap": "8px",
					"width": "auto",
				},
				children=[filter_control, sort_control, column_settings, create_view],
			),
		],
	)

	list_view = blocks.block(
		"ListView",
		"list-rows",
		props={
			# The page script's `wireColumns` — ColumnSettings' Column[] in the table's
			# render shape, falling back to the response's own columns until they're
			# seeded. Rendering the control's state (not the response's) is what makes a
			# column appear/disappear at once, ahead of the refetch. Never hardcoded.
			"columns": "{{ wireColumns }}",
			"rows": f"{{{{ {LIST_RESOURCE}.data.data }}}}",
			"rowKey": "name",
			"options": {
				"selectable": False,
				"showTooltip": True,
				# emptyState is read unguarded by ListEmptyState, so it must always be
				# present once `options` is passed at all — otherwise an empty result
				# set throws instead of rendering the empty state.
				"emptyState": {
					"title": "No records",
					"description": "Nothing to show here yet.",
				},
				# Function-valued props are compiled by codeStore.stringToFunction with
				# the script context (router, route, variables, resources) in scope.
				"onRowClick": "(row) => router.push(`/${route.params.doctype}/${row.name}`)",
			},
		},
		styles={"flexGrow": "1", "minHeight": "0", "width": "100%"},
	)

	body = blocks.container(
		"list-body",
		styles={
			"padding": "24px",
			"gap": "16px",
			"flexGrow": "1",
			"height": "100%",
			"minHeight": "0",
			# the sidebar is a flex sibling now: without this the table's intrinsic width
			# wins and the body overflows instead of shrinking
			"minWidth": "0",
		},
		children=[toolbar, quick_filter, list_view, view_dialog],
	)

	resource = {
		"resource_name": LIST_RESOURCE,
		"resource_type": "API Resource",
		"url": "crm.api.doc.get_data",
		"method": "POST",
		# On the saved-view page the script owns the first fetch (see this function's
		# docstring) — an auto fetch here would query the unfiltered defaults for nothing.
		"auto": 0 if saved_view else 1,
		# Params are evaluated ONCE, at resource creation, against {variables, route,
		# router} — enough for the route-derived doctype, and Studio rebuilds resources
		# on every route change, so slug -> slug navigation refetches. These are the
		# unfiltered defaults, i.e. the serialized form of the variables' initial values;
		# every later fetch comes from the page script's listData.submit(...).
		"params": json.dumps(
			{
				"doctype": DOCTYPE_EXPR,
				"filters": {},
				"order_by": DEFAULT_ORDER_BY,
				"page_length": PAGE_LENGTH,
				"page_length_count": PAGE_LENGTH,
			}
		),
	}

	resources = [resource, crm_sidebar.RESOURCE]
	if saved_view:
		resources.append(
			{
				"resource_name": VIEW_RESOURCE,
				"resource_type": "API Resource",
				"url": "crm.api.views.get_current_view",
				"method": "GET",
				"auto": 1,
				"params": json.dumps(
					{"doctype": DOCTYPE_EXPR, "view_name": "{{ route.params.viewName }}"}
				),
			}
		)

	return {
		"page_name": page_name,
		"page_title": page_title,
		"route": route,
		"blocks": blocks.root([crm_sidebar.instance("{{ route.params.doctype }}"), body]),
		"resources": resources,
		"variables": [
			*crm_sidebar.VARIABLES,
			{
				"variable_name": "doctypeMap",
				"variable_type": "Object",
				"initial_value": config.SLUG_TO_DOCTYPE,
			},
			# Object variables are JSON at runtime, and an array is valid JSON — so these
			# hold the controls' native lists. Studio re-runs setPageVariables on every
			# route change, which resets both when you navigate to another doctype (a
			# filter on CRM Lead's `status` would be meaningless on CRM Deal anyway).
			{"variable_name": "filters", "variable_type": "Object", "initial_value": []},
			{
				"variable_name": "sort",
				"variable_type": "Object",
				"initial_value": [{"fieldname": "modified", "direction": "desc"}],
			},
			# Empty until the page script seeds it from the first response's columns —
			# the doctype's defaults, which only the server knows (ui ADR-0006).
			{"variable_name": "columns", "variable_type": "Object", "initial_value": []},
			# The "Create view" dialog's open state and its name box.
			{"variable_name": "viewDialog", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "newViewLabel", "variable_type": "String", "initial_value": ""},
		],
		"script": SCRIPT,
	}


def build() -> dict:
	return build_page(PAGE_NAME, page_title="List", route="/:doctype", saved_view=False)

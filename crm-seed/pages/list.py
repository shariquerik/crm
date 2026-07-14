"""The Generic List Page at `/:doctype` (ADR-0002) — one page for every doctype.

`:doctype` is the REAL doctype name, not a slug (`/crm-studio/CRM Lead`), so the page
needs no doctype lookup of any kind: `route.params.doctype` IS the doctype, and every
non-single, non-child doctype the user can read works with no seed-time registration.
See config.py for why a slug would have capped the page at a fixed list. Rows come
straight out of `crm.api.doc.get_data` and the columns out of the doctype's Meta
(`in_list_view`), so nothing here is per-doctype either.

The screen has two header rows. The first says where you are and what you can add: frappe-ui
Breadcrumbs (the doctype), the view picker as its second crumb, and Create — which opens a
quick-entry dialog over CRM's "Quick Entry" layout (fields_layout.py) and inserts the record.
The second row is how you narrow it: the quick inputs on the left, the popovers on the right.

The two menus split along that line. The view picker holds the views AND "Save view", because
saving is something you do to a VIEW; the toolbar's "..." holds what you do to the CONTROLS
themselves (customize the quick filters). Neither is a toolbar button: the toolbar is for
narrowing the list.

That second row holds @framework/ui's four list controls — Filter, SortBy, QuickFilter,
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
import doctype_guard
import fields_layout
from components import crm_sidebar

PAGE_NAME = "crm-list"

# get_data's `filters` is annotated `dict`, so it must reach the server as JSON —
# a GET would send it through URLSearchParams as "[object Object]" and Frappe would
# raise FrappeTypeError. Hence method POST (frappe-ui puts the params in the body).
LIST_RESOURCE = "listData"

# The saved view being shown, on the saved-view page only. get_current_view falls back to a
# meta-derived standard view when the name matches nothing, so a stale URL still renders.
VIEW_RESOURCE = "currentView"

# The Create dialog's form: CRM's "Quick Entry" layout for the route's doctype, rendered by
# the same FormLayout the detail page uses (see fields_layout.py).
CREATE_LAYOUT_RESOURCE = "createLayout"

PAGE_LENGTH = 20
DEFAULT_ORDER_BY = "modified desc"

# The screen is three stacked bands — crumbs, controls, table — and the body holds no
# padding of its own, so each band sets its own. This one gutter keeps their left edges on
# the same line.
GUTTER = "20px"

# Only under the crumbs: it separates "where you are" from the whole working area below it.
# The controls and the table are ONE zone visually (the controls act on the table right under
# them), so a rule between those two would cut the thing it's supposed to sit on — their own
# padding is enough to keep them apart.
HEADER_DIVIDER = "1px solid var(--outline-gray-1)"

# The picker's entry for the plain /:doctype route — the list as the doctype's meta defines
# it, with nothing saved.
DEFAULT_VIEW_LABEL = "Default view"

# The controls read the doctype's Meta themselves, so the offered fields follow this one
# expression — and the route carries the doctype name, so there is nothing to look up.
DOCTYPE_EXPR = "{{ route.params.doctype }}"

# Doctype names contain spaces, so every link into this page must percent-encode the
# segment; vue-router decodes it back when it fills route.params.
LINK_DOCTYPE = "encodeURIComponent(route.params.doctype)"

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
import {{ computed, getCurrentScope, onScopeDispose, ref, watch }} from "vue"
import {{ call, toast }} from "frappe-ui"
// The controls ship the wire translation as pure helpers; the page script is compiled
// into the app bundle by studio's vite, which aliases @framework/ui — so reuse them
// rather than re-deriving the operator / column tables.
import {{ useDoctypeMeta }} from "@framework/ui"
import {{ getFilterableFields, parseFilters, serializeFilters }} from "@framework/ui/Filter"
import {{ parseOrderBy, serializeOrderBy }} from "@framework/ui/SortBy"
import {{
	applyColumnWidth,
	clearColumnWidth,
	fetchFields,
	getDefaultColumns,
	parseColumns,
	serializeColumns,
}} from "@framework/ui/ColumnSettings"

export default function setup(ctx: any) {{
	const {{ {LIST_RESOURCE}, filters, sort, columns, route, router }} = ctx
	// `{crm_sidebar.VIEWS_VARIABLE}` is not destructured here — the sidebar's snippet below already declares it
	// (it owns the fetch), and this script shares that one scope.
	const {{ viewDialog, newViewLabel, customizing }} = ctx
	const {{ {CREATE_LAYOUT_RESOURCE}, doctypeLabels, createDialog, newDoc, creating, createError }} = ctx
	const {{ selection, deleteDialog, deleting, deleteError }} = ctx
	// The route carries the doctype name itself ("CRM Lead"), already decoded by vue-router.
	const doctype = route.params.doctype
	// Only the saved-view page declares this resource, and only it has a :viewName.
	const {VIEW_RESOURCE} = ctx.{VIEW_RESOURCE}
	const viewName = route.params.viewName
{crm_sidebar.PAGE_SETUP}
{doctype_guard.PAGE_SETUP}

	// Meta is fetched once per doctype and shared with the controls (same memoised
	// composable). Three things need it: Column[] -> wire columns, the URL's wire filters ->
	// FilterCondition[] (which carry their field's Meta), and the DEFAULT columns — which
	// this page derives from Meta itself rather than taking the server's (see defaultColumns).
	//
	// Deferred until the guard confirms the doctype, NOT called here: useDoctypeMeta takes a
	// plain string and fetches at once, so on a slug or mistyped URL ("crm-lead", "nonsense")
	// it would fire a getdoctype for a name that doesn't exist and throw into the console —
	// on a page that is about to redirect or show Not Found anyway. The controls can't do
	// this: they live inside `body`, which only mounts once the doctype is confirmed.
	//
	// scope.run() puts the composable's watchers back inside THIS page's effect scope, so
	// they are still disposed on navigation — calling it bare from a watch callback would
	// leak them (the scope is only active during setup's synchronous run).
	const scope = getCurrentScope()
	const metaFields = ref<any[]>([])
	// The doctype's `title_field`, if it declares one: getDefaultColumns leads the default
	// set with it (Frappe shows the human title in place of the opaque `name`).
	const titleField = ref<string>("")
	function loadMeta(dt: string) {{
		const run = () => {{
			const {{ meta }} = useDoctypeMeta(dt)
			watch(
				meta,
				(m: any) => {{
					titleField.value = m?.title_field || ""
					metaFields.value = m?.fields ?? []
				}},
				{{ immediate: true }},
			)
		}}
		scope ? scope.run(run) : run()
	}}

	// The doctype's DEFAULT columns, derived from META — deliberately NOT from the
	// response's `columns`.
	//
	// get_data's defaults come from the controller's `default_list_data()`, a CRM
	// convention: a doctype whose controller lacks it gets a generic Name/Last Modified
	// pair, and one whose controller returns `{{"columns": []}}` (FCRM Note does exactly
	// that — CRM renders notes as cards, never as a list) gets NOTHING, so the table
	// paints a headerless grid of blank rows over real data. A generic list page cannot
	// depend on a per-doctype controller hook.
	//
	// Meta always has an answer: `in_list_view` is Frappe's own "show this in the list"
	// flag, and getDefaultColumns maps those fields to Column[] behind the title/name
	// leading column. A doctype that flags nothing falls back to Name + Last Modified —
	// the same pair get_data would have used, now guaranteed rather than incidental.
	const GENERIC_COLUMNS = [
		{{ fieldname: "name", label: "Name" }},
		{{ fieldname: "modified", label: "Last Modified" }},
	]
	function defaultColumns(fields: any[]) {{
		// Copied, not the const itself: this becomes the `columns` variable, which the control
		// (and a column resize) may mutate in place — the fallback must not be the thing that
		// gets mutated.
		if (!fields.some((f: any) => f.in_list_view)) return GENERIC_COLUMNS.map((c) => ({{ ...c }}))
		return getDefaultColumns(fields, titleField.value)
	}}

	// ColumnSettings speaks Column[] (`fieldname`, label, width?); get_data and the ListView
	// both speak the wire shape (`key`, label, width, type, align) — hence serializeColumns,
	// whose `type`/`align` come from Meta and are never stored on a Column.
	//
	// This is BOTH what the table renders and what the query asks for, so a column added or
	// removed in ColumnSettings repaints at once, ahead of the refetch that fills its cells.
	// The response's own `columns` are never consulted (they'd be the controller's defaults);
	// it is empty only before Meta lands, and the first fetch waits for that (see below), so
	// the table never has rows without columns.
	const modelColumns = computed(() =>
		(columns.value || []).length ? serializeColumns(columns.value, metaFields.value) : [],
	)

	// Column resize, from CrmListView's `column-resize` / `column-reset` events. Both write into
	// `columns` rather than into some private width state, because that IS the column model:
	// wireColumns serializes it, and frappe-ui's getGridTemplateColumns turns each `width` into
	// the grid's track (a string is a fixed size, a number is a flexing `fr`). So one write
	// resizes the table, moves the width ColumnSettings shows (it v-models the same variable, ui
	// ADR-0006), and is what a saved view stores. A reset drops the width and the column flexes
	// again.
	function resizeColumn(key: string, width: string) {{
		columns.value = applyColumnWidth(columns.value || [], key, width)
	}}

	function resetColumnWidth(key: string) {{
		columns.value = clearColumnWidth(columns.value || [], key)
	}}

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
			// How many rows to fetch (grown by Load More), and the page size the footer's
			// buttons show. get_data limits the query by page_length and only echoes
			// page_length_count back — the split is the footer's, not the server's.
			page_length: pageLength.value,
			page_length_count: pageSize.value,
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
	//
	// A column's `width` is stripped out of that comparison: it rides along in `columns`, but
	// it changes nothing about WHAT the server is being asked for (the fetched field set is
	// `rows`), so a drag must repaint the grid without re-hitting the server — which, at one
	// write per mousemove, is the whole difference between a resize and a refetch storm.
	function fetchKey(params: Record<string, unknown>) {{
		const wire = (params.columns as {{ width?: unknown }}[]) || []
		return JSON.stringify({{ ...params, columns: wire.map(({{ width, ...rest }}) => rest) }})
	}}
	// The footer's two numbers. Like every other page variable they have to be taken off `ctx`
	// to be in scope — a variable declared on the page but not destructured here is a
	// ReferenceError on first use, and one of those takes the WHOLE script down with it (no
	// refetch, no Create, no delete), not just the line that missed.
	const {{ pageSize, pageLength }} = ctx

	// The footer's two moves, and both of them are just a new `pageLength` — the watcher below
	// sees it change and re-sends the query.
	//
	// A page SIZE is a new page, not more of the old one: the running total goes back down to it.
	// So it is set unconditionally, not watched for a change — after three Load Mores at 20 you
	// are showing 60 rows with the size still 20, and clicking that same "20" has to take you
	// back to 20 rows. Watching `pageSize` would see no change there and do nothing, which is
	// why CrmListView reports every click on the strip rather than every change of it.
	//
	// "Load More" is the other way round: it leaves the size alone and grows the total by one
	// more page of it.
	function setPageSize(size: number) {{
		pageSize.value = size
		pageLength.value = size
	}}

	function loadMore() {{
		pageLength.value += pageSize.value
	}}

	let sent = fetchKey(listParams())
	let timer: ReturnType<typeof setTimeout> | undefined
	watch(
		[filters, sort, columns, pageLength],
		() => {{
			clearTimeout(timer)
			timer = setTimeout(() => {{
				const params = listParams()
				const encoded = fetchKey(params)
				if (encoded === sent) return
				sent = encoded
				{LIST_RESOURCE}.submit(params)
			}}, 250)
		}},
		{{ deep: true }},
	)
	onScopeDispose(() => clearTimeout(timer))

	// The ColumnSettings model starts empty and the control holds no defaults (ui ADR-0006):
	// the HOST owns them. Ours are Meta's, so seeding waits for Meta — which is also what
	// serializeColumns needs to derive each column's `type`/`align`.
	function seedColumns(fields: any[]) {{
		columns.value = defaultColumns(fields)
	}}

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

		// The view's columns ARE the defaults on this page — but a view saved without any
		// (or a standard view the server synthesised) falls back to Meta's, same as the
		// plain list.
		const viewColumns = JSON.parse(view.columns || "[]")
		if (viewColumns.length) columns.value = parseColumns(viewColumns)
		else seedColumns(fields)

		// The list resource is auto=0 on the saved-view page (its creation params can't see
		// the view: they are evaluated once, against {{variables, route, router}}), so this is
		// the FIRST fetch, not a refetch — and the debounce watch above then sees the same
		// params and skips.
		const params = listParams()
		sent = fetchKey(params)
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

	// Nothing above has fetched anything: both resources are auto=0, and the guard fires the
	// first one only once the server confirms the route names a real, listable doctype (and
	// that the URL is already the canonical spelling of it — otherwise it redirects there and
	// this setup runs again). A typo therefore costs exactly one request, not a failed
	// get_data for a doctype that doesn't exist.
	guardDoctype(() => {{
		// safe now: the route names a real doctype, in its canonical spelling
		loadMeta(doctype)
		if ({VIEW_RESOURCE}) {{
			// The saved-view page: its creation params (doctype + viewName, both from the
			// route) are correct, so a bare fetch() is right — applyView then fires the list.
			{VIEW_RESOURCE}.fetch()
			return
		}}
		// The plain list page waits for Meta before its FIRST fetch, because the default
		// columns come from Meta: firing earlier would send a column-less request whose
		// answer we'd throw away the moment Meta seeded the columns, i.e. two round trips
		// and a frame of blank rows. The debounce watch above sees this same `columns`
		// write, recomputes the params, finds them identical to `sent`, and skips.
		//
		// A flag, not the watcher's own stop handle: useDoctypeMeta is memoised per doctype,
		// so on a revisit Meta is already in and `immediate` runs this callback SYNCHRONOUSLY,
		// while `stop` is still in its TDZ. The flag also keeps a later Meta reload from
		// re-seeding columns the user has since changed.
		let started = false
		watch(
			metaFields,
			(fields: any[]) => {{
				if (started || !fields.length) return
				started = true
				seedColumns(fields)
				const params = listParams()
				sent = fetchKey(params)
				{LIST_RESOURCE}.submit(params)
			}},
			{{ immediate: true }},
		)
	}}, viewName ? `/view/${{viewName}}` : "")

	// The picker. Its rows are the `{crm_sidebar.VIEWS_VARIABLE}` variable the sidebar's snippet fetched (grouped by
	// doctype) — one fetch feeds both the sidebar and this. Switching a view is a plain route
	// change: Studio re-runs the page's setup on every navigation, so the new view loads itself.
	const doctypeViews = computed(() => ({crm_sidebar.VIEWS_VARIABLE}.value || {{}})[doctype] || [])

	const viewLabel = computed(() => {{
		if (!viewName) return "{DEFAULT_VIEW_LABEL}"
		const row = doctypeViews.value.find((v: any) => String(v.name) === String(viewName))
		return row?.label || {VIEW_RESOURCE}?.data?.label || "View"
	}})

	// The picker lists the views AND the one thing you do to a view — save the current state as
	// a new one. "Save view" belongs here, next to the views it creates, rather than as a fifth
	// button in the toolbar: the toolbar is for narrowing the list, not for managing views.
	// Two groups, so "Save view" reads as an action on the list rather than as one more view to
	// switch to. `options` (not the deprecated `items`) is the current key for a group's rows,
	// and hideLabel keeps the second group as a plain divided section with no heading.
	//
	// A `lucide-*` icon is a CSS class Tailwind only emits where it SCANS the name — and this
	// script is compiled into the app bundle from the exported .ts, which Studio's tailwind
	// content DOES cover. (The block JSON is not, which is why the Dropdown's own button icon
	// below is a Feather name instead.)
	const viewOptions = computed(() => [
		{{
			group: "Views",
			options: [
				{{ label: "{DEFAULT_VIEW_LABEL}", onClick: () => router.push(`/${{{LINK_DOCTYPE}}}`) }},
				...doctypeViews.value.map((view: any) => ({{
					label: view.label,
					onClick: () => router.push(`/${{{LINK_DOCTYPE}}}/view/${{view.name}}`),
				}})),
			],
		}},
		{{
			group: "Actions",
			hideLabel: true,
			options: [
				{{
					label: "Save view",
					icon: "lucide-plus",
					onClick: () => {{
						viewDialog.value = true
					}},
				}},
			],
		}},
	])

	// The toolbar's "..." menu: what you do TO the controls, as opposed to what you do WITH
	// them. QuickFilter owns its edit mode through a `customizing` v-model it deliberately
	// leaves to the host — so this is the trigger, and the control itself draws the chip
	// editor and its Done button in place of the inputs.
	const controlOptions = computed(() => [
		{{
			label: "Customize Quick Filter",
			icon: "lucide-sliders-horizontal",
			onClick: () => {{
				customizing.value = true
			}},
		}},
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
		router.push(`/${{{LINK_DOCTYPE}}}/view/${{view.name}}`)
	}}

	const createViewActions = computed(() => [
		{{
			label: "Create",
			variant: "solid",
			disabled: !(newViewLabel.value || "").trim(),
			onClick: createView,
		}},
	])

	// --- the header ------------------------------------------------------------------
	// The curated doctypes have a nicer plural ("Leads"); anything else — and any doctype
	// can be reached by URL — shows as its own name. Same fallback as the detail page.
	const doctypeLabel = computed(() => doctypeLabels.value[doctype] || doctype)

	// One crumb: the list itself. The VIEW is the second crumb, and it is a Dropdown rather
	// than a Breadcrumbs item (an item is a link, not a picker) — so the block tree draws it
	// next to the "/" separator instead. See build_page.
	const breadcrumbs = computed(() => [
		{{ label: doctypeLabel.value, route: `/${{{LINK_DOCTYPE}}}` }},
	])

	// --- create ------------------------------------------------------------------------
	// "Create" opens a quick-entry dialog: CRM's "Quick Entry" layout for the route's
	// doctype, handed to the same FormLayout the detail page uses. get_fields_layout
	// synthesizes a layout for a doctype that has none, so this stays as generic as the
	// rest of the page — nothing per-doctype is registered anywhere.
	// The doctype's own name, not the sidebar's plural: "New CRM Lead", never "New Leads".
	const createTitle = `New ${{doctype}}`

	function openCreate() {{
		// A fresh blank doc each time: FormLayout edits this object in place, so reusing the
		// last one would pre-fill the form with an abandoned draft.
		newDoc.value = {{}}
		createError.value = ""
		// The layout is fetched on the FIRST open, not with the page: a user who only browses
		// the list never pays for it. Its creation params (the route's doctype) are already
		// right, so a bare fetch() is correct here.
		if (!{CREATE_LAYOUT_RESOURCE}.data && !{CREATE_LAYOUT_RESOURCE}.loading) {CREATE_LAYOUT_RESOURCE}.fetch()
		createDialog.value = true
	}}

	async function createDoc() {{
		if (creating.value) return
		creating.value = true
		createError.value = ""
		try {{
			// The same insert CRM's own frontend does — no CRM-specific endpoint needed. The
			// server enforces mandatory fields and permissions; a missing one throws, and the
			// dialog stays open showing why.
			const doc = await call("frappe.client.insert", {{ doc: {{ doctype, ...(newDoc.value || {{}}) }} }})
			createDialog.value = false
			toast.success(`${{doctype}} created`)
			// Straight into the new record, where the full form is.
			router.push(`/${{{LINK_DOCTYPE}}}/${{encodeURIComponent(doc.name)}}`)
		}} catch (error: any) {{
			createError.value = errorMessage(error)
		}} finally {{
			creating.value = false
		}}
	}}

	const createActions = computed(() => [
		{{ label: "Create", variant: "solid", loading: creating.value, onClick: createDoc }},
	])

	// frappe-ui's `call` rejects with the server messages attached (e.g. "Value missing for
	// CRM Lead: First Name"); never swallow them.
	function errorMessage(error: any) {{
		if (error?.messages?.length) return error.messages.join("\\n")
		return error?.message || "Something went wrong"
	}}

	// ─── Bulk delete ────────────────────────────────────────────────────────────────────
	// `selection` is the two-way variable CrmListView holds the ticked rows in (their docnames).
	// Reading it is how Delete knows what to delete; writing [] is how the selection is CLEARED
	// — the component turns that into ListView's own toggleAllRows, which is the only thing that
	// can move a Set ListView owns.
	const deleteTitle = computed(() =>
		selection.value.length === 1 ? "Delete 1 record?" : `Delete ${{selection.value.length}} records?`,
	)

	// The banner's buttons (CrmListView renders them into ListSelectBanner's actions slot).
	// Delete only opens the confirm dialog — nothing is destroyed on this click.
	const bulkActions = computed(() => [
		{{ label: "Delete", theme: "red", onClick: () => (deleteDialog.value = true) }},
	])

	// A refetch replaces the rows under a selection the component would otherwise keep: filter
	// something out while it's ticked and it stays selected but invisible, and Delete would then
	// hit records the user can't see. The selection means "these rows, the ones in front of
	// you", so it is dropped whenever the list is re-fetched.
	watch(() => {LIST_RESOURCE}.data, () => (selection.value = []))

	async function deleteSelected() {{
		const items = selection.value
		if (!items.length) return
		deleting.value = true
		deleteError.value = ""
		try {{
			await call("crm.api.doc.delete_bulk_docs", {{ doctype, items }})
			deleteDialog.value = false
			// Over 10 records the server ENQUEUES the delete (crm.api.doc.delete_bulk_docs) and
			// returns straight away, so the rows are still there on the next fetch. Say that,
			// rather than showing a list that looks like the delete silently failed.
			toast.success(
				items.length > 10
					? `Deleting ${{items.length}} records in the background`
					: `Deleted ${{items.length}} record${{items.length === 1 ? "" : "s"}}`,
			)
			selection.value = []
			{LIST_RESOURCE}.submit(listParams())
		}} catch (error: any) {{
			// The dialog stays open, holding the reason — a delete blocked by a link ("Cannot
			// delete because it is linked with…") or by permission is exactly what to show.
			deleteError.value = errorMessage(error)
		}} finally {{
			deleting.value = false
		}}
	}}

	const deleteActions = computed(() => [
		{{
			label: "Delete",
			variant: "solid",
			theme: "red",
			loading: deleting.value,
			onClick: deleteSelected,
		}},
	])

	// Exposed to the block expressions. `wireColumns` is the ColumnSettings model in the
	// table's render shape (see modelColumns) — the control's state, not the response's.
	return {{
		wireColumns: modelColumns,
		breadcrumbs,
		viewLabel,
		viewOptions,
		controlOptions,
		createViewActions,
		createTitle,
		createActions,
		openCreate,
		// For CrmListView: its two resize events land in `columns`, and its banner's buttons
		// come from here. (A returned binding is in scope for a block's function-valued props,
		// the same way `openCreate` is for the toolbar's buttons.)
		resizeColumn,
		resetColumnWidth,
		// The footer's two buttons. A function only reaches a block's props by being RETURNED here
		// — being declared in the script is not enough. (`pageSize`, the other half of the
		// footer, needs none of this: it is a page VARIABLE, and a block binds those by name.)
		loadMore,
		setPageSize,
		bulkActions,
		deleteTitle,
		deleteActions,
	}}
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
	# Styles are set on the WRAPPER, not on the QuickFilter block: the component's template is
	# a v-if/v-else pair, so Vue has no single root to fall the `style` attr through to and
	# Studio's baseStyles are silently dropped (verified in the DOM — the root carries no
	# style attribute at all). It shared a row with nothing before, so a column parent
	# stretched it anyway; now that it sits beside the popovers it has to be told to take the
	# leftover room. QuickFilter measures its own width to decide how many inputs fit inline
	# before collapsing them behind "N more" — so the wrapper's width IS what the user sees.
	quick_filter = blocks.container(
		"list-quickfilter-wrap",
		styles={"flexGrow": "1", "minWidth": "0", "width": "auto"},
		children=[
			blocks.block(
				"QuickFilter",
				"list-quickfilter",
				# `customizing` is the control's edit mode, and it is deliberately the HOST's to
				# own — the control draws the chip editor but offers no way in. The "..." menu is
				# that way in; binding it here is what connects the two. `fields` stays UNBOUND:
				# it defaults to undefined, which is what makes the control fall back to Meta's
				# `in_standard_filter` set — an Object variable would start as [] and surface no
				# inputs at all.
				props={
					"doctype": DOCTYPE_EXPR,
					"filters": blocks.bind("filters"),
					"customizing": blocks.bind("customizing"),
				},
			)
		],
	)

	# The view picker — the header's SECOND crumb. Breadcrumbs items are links, not pickers,
	# so the view can't be one of them: it is a Dropdown sitting after a "/" of our own
	# (frappe-ui only draws separators BETWEEN its own items). Its options are built in the
	# page script (each carries the router.push that switches to it), so this is a pure
	# renderer of `viewOptions`; the button reads the view currently on screen.
	view_picker = blocks.block(
		"Dropdown",
		"list-view-picker",
		props={
			"options": "{{ viewOptions }}",
			"button": {
				"label": "{{ viewLabel }}",
				"variant": "ghost",
				"iconRight": "chevron-down",
			},
		},
	)

	# The toolbar's "..." — the actions ON the controls (today: customize the quick filters).
	# Its options are built in the page script, like the view picker's.
	#
	# `more-horizontal` is a FEATHER name, not a `lucide-` one, and that is on purpose: a
	# lucide icon is a CSS class Tailwind only emits where it SCANS the name, and Studio scans
	# the exported page scripts (.ts) but never the page's block JSON — so a `lucide-*` icon
	# named only here would render as an empty box. Button routes any non-`lucide-` string to
	# FeatherIcon, which is a component and needs no such generation.
	control_menu = blocks.block(
		"Dropdown",
		"list-control-menu",
		props={
			"options": "{{ controlOptions }}",
			"button": {"icon": "more-horizontal", "variant": "subtle"},
			"placement": "right",
		},
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

	create_button = blocks.block(
		"Button",
		"list-create",
		props={"label": "Create", "variant": "solid", "iconLeft": "plus"},
		events={"click": blocks.event("click", "function handleEvent() { openCreate() }")},
	)

	# Row 1 — where you are, and the one thing you can add here. Its own band: the body
	# carries no padding of its own (see body), so each row states its own — that is what
	# keeps the three zones (crumbs / controls / table) from bleeding into one another.
	header = blocks.container(
		"list-header",
		styles={
			"flexDirection": "row",
			"alignItems": "center",
			"justifyContent": "space-between",
			"gap": "8px",
			# min-height rather than vertical padding: the row's height is set by the tallest
			# control in it (Create), so a fixed floor keeps it steady whatever sits here.
			"minHeight": "48px",
			"padding": f"0 {GUTTER}",
			"borderBottom": HEADER_DIVIDER,
			"flexShrink": "0",
		},
		children=[
			blocks.container(
				"list-crumbs",
				styles={
					"flexDirection": "row",
					"alignItems": "center",
					"gap": "2px",
					"width": "auto",
					# a long doctype/view name must truncate inside the crumbs, not push the
					# Create button off the row
					"minWidth": "0",
				},
				children=[
					blocks.block(
						"Breadcrumbs",
						"list-breadcrumbs",
						props={"items": "{{ breadcrumbs }}"},
					),
					blocks.block(
						"TextBlock",
						"list-crumb-separator",
						props={"text": "/"},
						styles={"color": "var(--ink-gray-4)", "flexShrink": "0"},
					),
					view_picker,
				],
			),
			create_button,
		],
	)

	# Row 2 — how you narrow it. The quick inputs take the room; the popovers and the "..."
	# sit right. Same gutter as row 1, and no rule beneath it: it belongs to the table below
	# (see HEADER_DIVIDER).
	controls = blocks.container(
		"list-controls",
		styles={
			"flexDirection": "row",
			# TOP-aligned, not centred: QuickFilter wraps to a second line once its inputs stop
			# fitting ("Show less"), and a centred row would then drift the popovers down to the
			# middle of that block, out of line with the inputs they belong beside. Anchored to
			# the top they stay on the first line however tall the left side grows.
			"alignItems": "flex-start",
			"justifyContent": "space-between",
			"gap": "8px",
			"padding": f"8px {GUTTER}",
			"flexShrink": "0",
		},
		children=[
			quick_filter,
			blocks.container(
				"list-control-buttons",
				styles={
					"flexDirection": "row",
					"alignItems": "center",
					"gap": "8px",
					"width": "auto",
					"flexShrink": "0",
				},
				# Gone while the quick filters are being customized: the row then belongs to the
				# chip editor and its Done button, and the popovers beside it would act on a list
				# the user isn't looking at. It also frees the whole row for the chips. The "..."
				# that STARTED customizing is in here too, so the way out is Done — one exit, and
				# no way to re-enter a mode you are already in.
				visibility="{{ !customizing }}",
				children=[filter_control, sort_control, column_settings, control_menu],
			),
		],
	)

	# The Create dialog. Same FormLayout the detail page renders, over the "Quick Entry"
	# layout instead of "Data Fields" — so a doctype's short new-record form is whatever CRM
	# says it is, and a doctype without one gets the layout get_fields_layout synthesizes.
	# The Create button is built in the page script (its onClick lives there) and bound as
	# data, exactly like the Save-view dialog's.
	create_dialog = blocks.block(
		"Dialog",
		"list-create-dialog",
		props={
			"modelValue": blocks.bind("createDialog"),
			"title": "{{ createTitle }}",
			"size": "xl",
			"actions": "{{ createActions }}",
		},
		children=[
			blocks.block(
				"FormLayout",
				"list-create-form",
				props={
					"layout": f"{{{{ {CREATE_LAYOUT_RESOURCE}.data || [] }}}}",
					# two-way: FormLayout's `defineModel("doc")` writes the edits straight into
					# `newDoc`, which is what gets inserted.
					"doc": blocks.bind("newDoc"),
				},
				# Don't mount before the layout has landed: FormLayout renders frappe-ui's Tabs,
				# which reads `props.tabs[0].label` unguarded — an empty layout throws in the
				# render function (same guard as the detail page's form).
				visibility=f"{{{{ {CREATE_LAYOUT_RESOURCE}.data?.length }}}}",
				styles={"width": "100%"},
			),
			# A rejected insert (a missing mandatory field, no permission) says so here, and the
			# dialog stays open with what the user typed.
			blocks.block(
				"ErrorMessage",
				"list-create-error",
				props={"message": "{{ createError }}"},
				visibility="{{ createError }}",
			),
		],
	)

	# The confirm step for the banner's Delete: the button (a `bulkAction`) only opens this, and
	# the delete itself hangs off the dialog's action — so a misclick in the banner costs nothing.
	delete_dialog = blocks.block(
		"Dialog",
		"list-delete-dialog",
		props={
			"modelValue": blocks.bind("deleteDialog"),
			"title": "{{ deleteTitle }}",
			"actions": "{{ deleteActions }}",
		},
		children=[
			blocks.block(
				"TextBlock",
				"list-delete-message",
				props={"text": "This cannot be undone."},
				styles={"fontSize": "14px", "color": doctype_guard.MUTED_TEXT},
			),
			# A delete the server refuses — a linked document, or no permission — says so here,
			# and the dialog stays open.
			blocks.block(
				"ErrorMessage",
				"list-delete-error",
				props={"message": "{{ deleteError }}"},
				visibility="{{ deleteError }}",
			),
		],
	)

	# CrmListView, not frappe-ui's ListView: the app's own SFC (apps/crm/studio/crm_studio/
	# components/), which is frappe-ui's ListView with the three things it keeps to itself
	# opened up — the column-resize event it never re-emits, the selection it won't let anyone
	# write, and the select banner's actions slot it renders internally. Everything below is
	# ordinary props and events because of that; without it, each one needed the page script to
	# reach into frappe-ui's DOM. See the component's own header for the why.
	list_view = blocks.custom_component(
		"CrmListView",
		"list-rows",
		props={
			# The page script's `wireColumns` — ColumnSettings' Column[] in the table's
			# render shape. Rendering the control's state (not the response's) is what
			# makes a column appear/disappear at once, ahead of the refetch; the control
			# is seeded from the doctype's Meta (`in_list_view`). Never hardcoded.
			"columns": "{{ wireColumns }}",
			"rows": f"{{{{ {LIST_RESOURCE}.data.data }}}}",
			"rowKey": "name",
			# Two-way, so the page both READS the selection and clears it: writing [] back into
			# this variable is what unticks the checkboxes (CrmListView turns that into
			# ListView's own toggleAllRows — the component owns the Set).
			"selection": blocks.bind("selection"),
			# The buttons in the selection banner. Delete only confirms here; the deleting is in
			# the dialog's action, so a misclick can still be backed out of.
			"bulkActions": "{{ bulkActions }}",
			# A drag, and a double-click to put the column back to auto width. Both carry the
			# column's key, and both land in `columns` — the same list ColumnSettings edits and a
			# saved view stores — so a width is one fact, held in one place.
			"onColumnResize": "(event) => resizeColumn(event.key, event.width)",
			"onColumnReset": "(event) => resetColumnWidth(event.key)",
			# The gutter the header and rows sit in from, handed to the component instead of
			# padded onto the block around it. Inside, it lands as a MARGIN on the header and on
			# the rows, which leaves the scrolling box itself full-bleed — so the scrollbar keeps
			# to the right edge of the page while the rows still stop a gutter short of it. Same
			# 20px as every other band on this page, so the column titles line up with the crumbs.
			"gutter": GUTTER,
			# The footer. Both counts are the SERVER's, off the same response the rows came from:
			# row_count is how many came back, total_count how many the filters match in all — so
			# "Load More" shows itself exactly while there is more left to load, and hides when the
			# two meet. The page size is two-way (the buttons write it); what a Load More actually
			# asks for is decided in the script, not here.
			"rowCount": f"{{{{ {LIST_RESOURCE}.data.row_count }}}}",
			"totalCount": f"{{{{ {LIST_RESOURCE}.data.total_count }}}}",
			# Two-way only so a button stays lit; the size that COUNTS arrives as the event below,
			# which fires on every click — including a click on the size already selected, which is
			# how you ask for the first N rows back after a Load More.
			"pageSize": blocks.bind("pageSize"),
			"onPageSize": "(size) => setPageSize(size)",
			"onLoadMore": "() => loadMore()",
			"options": {
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
				"onRowClick": (
						# Both segments are encoded: a doctype name has spaces, and a docname
						# can have them too (and a "/" would otherwise invent a route segment).
						"(row) => router.push("
						"`/${encodeURIComponent(route.params.doctype)}"
						"/${encodeURIComponent(row.name)}`)"
					),
			},
		},
		styles={"flexGrow": "1", "minHeight": "0", "width": "100%"},
	)

	# Zone 3 — the table. Alone among the three bands it carries NO padding except the 8px that
	# sets it off from the controls above: it runs full-bleed to the left, right and bottom
	# edges of the page. Its gutter is the `gutter` prop above, which CrmListView spends as a
	# MARGIN on the header and the rows — so the content still stops 20px short of the edges,
	# while the box that scrolls does not. That is what lets the scrollbars sit in the corners
	# where scrollbars belong: the vertical one runs the full height of the list and the
	# horizontal one the full width, instead of stopping a gutter short of each edge. Padding
	# here would carry them inward with the content.
	#
	# minHeight 0 is what lets this wrapper shrink below its content, so the table (and not the
	# page) is the thing that scrolls.
	table = blocks.container(
		"list-table",
		styles={
			"padding": "8px 0 0 0",
			"flexGrow": "1",
			"minHeight": "0",
			"minWidth": "0",
		},
		children=[list_view],
	)

	body = blocks.container(
		"list-body",
		styles={
			# No padding and no gap here on purpose: the three zones each carry their own,
			# so the crumbs / controls / table bands can be spaced (and divided) separately.
			"flexGrow": "1",
			"height": "100%",
			"minHeight": "0",
			# the sidebar is a flex sibling now: without this the table's intrinsic width
			# wins and the body overflows instead of shrinking
			"minWidth": "0",
		},
		children=[header, controls, table, view_dialog, create_dialog, delete_dialog],
		# The whole screen hangs off the guard: it renders only once the server has confirmed
		# the route's doctype, and only when the URL is already its canonical spelling (a slug
		# is redirected, not rendered). Its sibling is the Not Found panel.
		visibility=doctype_guard.RESOLVED,
	)

	resource = {
		"resource_name": LIST_RESOURCE,
		"resource_type": "API Resource",
		"url": "crm.api.doc.get_data",
		"method": "POST",
		# The script owns the FIRST fetch on both pages now — the guard fires it once the
		# route's doctype is confirmed. An auto fetch would race that and query a doctype
		# the URL may not even name.
		"auto": 0,
		# Params are evaluated ONCE, at resource creation, against {variables, route,
		# router} — enough for the route's doctype, since the route carries the name itself.
		# These are the unfiltered defaults, i.e. the serialized form of the variables'
		# initial values; every fetch comes from the page script's listData.submit(...).
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

	resources = [
		resource,
		crm_sidebar.RESOURCE,
		doctype_guard.RESOURCE,
		# auto=0 and NOT fired by the guard either: the page script fetches it the first time
		# the Create dialog opens (see openCreate).
		fields_layout.resource(CREATE_LAYOUT_RESOURCE, fields_layout.QUICK_ENTRY),
	]
	if saved_view:
		resources.append(
			{
				"resource_name": VIEW_RESOURCE,
				"resource_type": "API Resource",
				"url": "crm.api.views.get_current_view",
				"method": "GET",
				# Fetched by the guard, like the list: get_current_view calls get_meta on the
				# doctype, so firing it for a route that names no doctype would just throw.
				"auto": 0,
				"params": json.dumps(
					{"doctype": DOCTYPE_EXPR, "view_name": "{{ route.params.viewName }}"}
				),
			}
		)

	return {
		"page_name": page_name,
		"page_title": page_title,
		"route": route,
		"blocks": blocks.root(
			[crm_sidebar.instance("{{ route.params.doctype }}"), body, doctype_guard.block("list-not-found")]
		),
		"resources": resources,
		"variables": [
			*crm_sidebar.VARIABLES,
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
			# QuickFilter's edit mode, flipped by the toolbar's "..." menu. The control renders
			# its chip editor while this is true and clears it itself on Done.
			{"variable_name": "customizing", "variable_type": "Boolean", "initial_value": False},
			# doctype -> its nicer plural, for the breadcrumb. Only the curated doctypes have
			# one; a list of any OTHER doctype still opens here (the route carries the name, so
			# there is nothing to register) and falls back to showing the doctype itself.
			{
				"variable_name": "doctypeLabels",
				"variable_type": "Object",
				"initial_value": config.DOCTYPE_LABELS,
			},
			# The Create dialog: its open state, the doc being typed (FormLayout's model) and
			# the insert's in-flight / failed state.
			{"variable_name": "createDialog", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "newDoc", "variable_type": "Object", "initial_value": {}},
			{"variable_name": "creating", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "createError", "variable_type": "String", "initial_value": ""},
			# The ticked rows (docnames), two-way with CrmListView: the component writes the
			# selection here, and the page clears it by writing [] back.
			{"variable_name": "selection", "variable_type": "Object", "initial_value": []},
			# The two numbers behind the footer, and they are NOT the same number.
			#
			# `pageSize` is the page-size the footer's buttons are set to (20 / 50 / 100) — a
			# choice. `pageLength` is how many rows the server is actually being asked for — a
			# running total, which is what "Load More" grows by one pageSize at a time. Holding
			# them apart is what lets the buttons keep showing 20 after you have loaded 60 rows;
			# one variable would have to show 60, which is not one of the buttons, and the strip
			# would go blank. (This is how hand-written CRM does it too: page_length grows, and
			# page_length_count stays the page size.)
			{"variable_name": "pageSize", "variable_type": "Number", "initial_value": PAGE_LENGTH},
			{"variable_name": "pageLength", "variable_type": "Number", "initial_value": PAGE_LENGTH},
			# The bulk-delete confirm dialog, opened by the Delete button in the selection banner.
			{"variable_name": "deleteDialog", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "deleting", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "deleteError", "variable_type": "String", "initial_value": ""},
		],
		"script": SCRIPT,
	}


def build() -> dict:
	return build_page(PAGE_NAME, page_title="List", route="/:doctype", saved_view=False)

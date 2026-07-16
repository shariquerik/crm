// List page: the toolbar's four controls hold the narrowing, the ordering and the shown
// columns in @framework/ui's own shapes (FilterCondition[] / Sort[] / Column[]). Nothing
// else does — the controls never fetch. This script is the only place those shapes are
// translated into what `crm.api.doc.get_data` takes, and the only thing that refetches.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources
// by name and route/router. What it RETURNS is exposed to the block expressions
// ({{ wireColumns }}), which is how the table repaints the instant ColumnSettings
// changes, without waiting for the refetch.
//
// The page's STATE is declared here too, as plain refs, rather than in the Studio
// Variables panel — one place to read the page from, next to the code that drives it,
// with a real initial value instead of a JSON string. A returned ref binds exactly like
// a panel variable: a block's `{{ }}` reads it unwrapped, and a two-way `$type: variable`
// prop writes straight through to `.value` (codeStore's setValueInVariable checks isRef).
// Two constraints come with it, and both hold on this page: the binding must be a REF
// (a plain object bound with v-model would be written to a phantom variable instead), and
// a resource's creation params can't see these — they are evaluated against the panel's
// variables + route/router only, and no resource here references page state.
import { computed, getCurrentScope, onScopeDispose, ref, watch } from "vue"
import { call, toast } from "frappe-ui"
// The controls ship the wire translation as pure helpers; the page script is compiled
// into the app bundle by studio's vite, which aliases @framework/ui — so reuse them
// rather than re-deriving the operator / column tables.
import { useDoctypeMeta } from "@framework/ui"
import { getFilterableFields, parseFilters, serializeFilters } from "@framework/ui/Filter"
import { parseOrderBy, serializeOrderBy } from "@framework/ui/SortBy"
import {
	applyColumnWidth,
	clearColumnWidth,
	fetchFields,
	getDefaultColumns,
	parseColumns,
	serializeColumns,
} from "@framework/ui/ColumnSettings"

// The curated doctypes' nicer plurals, read by the header here and by the block tree
// ({{ doctypeLabels[route.params.doctype] }}). A frozen lookup, never written, so it is a
// plain object rather than a ref — a `{{ }}` read unwraps a binding whether or not it is
// one. (Anything the blocks bind TWO-WAY must still be a ref; see the note above.)
const doctypeLabels: Record<string, string> = {
	"CRM Lead": "Leads",
	"CRM Deal": "Deals",
	Contact: "Contacts",
	"CRM Organization": "Organizations",
	"CRM Task": "Tasks",
	"FCRM Note": "Notes",
}

export default function setup(ctx: any) {
	// Resources stay on ctx — Studio owns their lifecycle, and only it can create them.
	const { listData, createLayout, route, router } = ctx

	// --- page state ---------------------------------------------------------------------
	// The toolbar's four controls own these; every one is bound two-way from the block tree.
	const filters = ref<any[]>([])
	const sort = ref<any[]>([{ fieldname: "modified", direction: "desc" }])
	const columns = ref<any[]>([])
	// The saved views the sidebar renders, grouped by doctype (fetched below).
	const views = ref<Record<string, any[]>>({})
	// "Save view" dialog.
	const viewDialog = ref(false)
	const newViewLabel = ref("")
	// QuickFilter's edit mode, which the control leaves to its host.
	const customizing = ref(false)
	// Quick-entry dialog.
	const createDialog = ref(false)
	const newDoc = ref<Record<string, any>>({})
	const creating = ref(false)
	const createError = ref("")
	// The ticked rows (docnames), two-way with CrmListView.
	const selection = ref<string[]>([])
	// The footer's two numbers: the page size the strip shows, and the running total fetched.
	const pageSize = ref(20)
	const pageLength = ref(20)
	// Bulk-delete confirm dialog.
	const deleteDialog = ref(false)
	const deleting = ref(false)
	const deleteError = ref("")

	// The route carries the doctype name itself ("CRM Lead"), already decoded by vue-router.
	const doctype = route.params.doctype
	// Only the saved-view page declares this resource, and only it has a :viewName.
	const currentView = ctx.currentView
	const viewName = route.params.viewName

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `views` ref the component
	// renders. The list page's view picker reads the same ref: one fetch, one source of truth.
	// The call goes through `ctx.call` (Studio puts frappe-ui's `call` in every script's
	// context) rather than an import, because the pages' scripts share no set of static
	// imports — the home page imports nothing from frappe-ui.
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {
		// Grouped by the doctype they belong to — which is also all a row needs to build its
		// URL, since the route carries the doctype name itself (`/:doctype/view/:viewName`).
		// So a view on ANY doctype routes correctly, not just the six the sidebar advertises.
		const grouped: Record<string, any[]> = {}
		for (const row of rows || []) {
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!row.dt || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), row]
		}
		views.value = grouped
	})

	// Nothing is fetched until the server has resolved the route's doctype: a typo must not
	// fire a get_data for a doctype that does not exist, and a slug URL is about to be
	// replaced by its canonical one anyway (which re-runs this whole setup).
	function guardDoctype(onResolved: () => void, suffix = "") {
		const { routeDoctype } = ctx
		let done = false
		watch(
			() => routeDoctype.data,
			(res: any) => {
				if (done || !res) return
				// resolved to nothing — the Not Found panel is what renders; do NOT fetch.
				if (!res.doctype) return
				if (res.doctype !== route.params.doctype) {
					// a slug or a different casing: send the browser to the canonical URL.
					// replace(), not push(), so Back doesn't bounce through the alias.
					done = true
					router.replace(`/${encodeURIComponent(res.doctype)}${suffix}`)
					return
				}
				done = true
				onResolved()
			},
			{ immediate: true },
		)
	}

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
	function loadMeta(dt: string) {
		const run = () => {
			const { meta } = useDoctypeMeta(dt)
			watch(
				meta,
				(m: any) => {
					titleField.value = m?.title_field || ""
					metaFields.value = m?.fields ?? []
				},
				{ immediate: true },
			)
		}
		scope ? scope.run(run) : run()
	}

	// The doctype's DEFAULT columns, derived from META — deliberately NOT from the
	// response's `columns`.
	//
	// get_data's defaults come from the controller's `default_list_data()`, a CRM
	// convention: a doctype whose controller lacks it gets a generic Name/Last Modified
	// pair, and one whose controller returns `{"columns": []}` (FCRM Note does exactly
	// that — CRM renders notes as cards, never as a list) gets NOTHING, so the table
	// paints a headerless grid of blank rows over real data. A generic list page cannot
	// depend on a per-doctype controller hook.
	//
	// Meta always has an answer: `in_list_view` is Frappe's own "show this in the list"
	// flag, and getDefaultColumns maps those fields to Column[] behind the title/name
	// leading column. A doctype that flags nothing falls back to Name + Last Modified —
	// the same pair get_data would have used, now guaranteed rather than incidental.
	const GENERIC_COLUMNS = [
		{ fieldname: "name", label: "Name" },
		{ fieldname: "modified", label: "Last Modified" },
	]
	function defaultColumns(fields: any[]) {
		// Copied, not the const itself: this becomes the `columns` variable, which the control
		// (and a column resize) may mutate in place — the fallback must not be the thing that
		// gets mutated.
		if (!fields.some((f: any) => f.in_list_view)) return GENERIC_COLUMNS.map((c) => ({ ...c }))
		return getDefaultColumns(fields, titleField.value)
	}

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
	function resizeColumn(key: string, width: string) {
		columns.value = applyColumnWidth(columns.value || [], key, width)
	}

	function resetColumnWidth(key: string) {
		columns.value = clearColumnWidth(columns.value || [], key)
	}

	// get_data's `filters` is a DICT, so it holds one condition per field: the
	// [fieldname, operator, value] triples serializeFilters returns collapse to
	// {fieldname: [operator, value]} and a second condition on the same field wins.
	// (Different fields combine as AND, which is what the toolbar shows.)
	function toFiltersDict(conditions: any[]) {
		const dict: Record<string, [string, unknown]> = {}
		for (const [fieldname, operator, value] of serializeFilters(conditions)) {
			dict[fieldname] = [operator, value]
		}
		return dict
	}

	// A row the user added but hasn't filled in yet (a fresh `like` with no text, a Date
	// `between` with no range) is not a narrowing: sending it would match nothing (LIKE
	// "%%" drops NULLs) or make get_list throw on a null value.
	function isComplete(condition: any) {
		const value = condition?.value
		if (value === null || value === undefined || value === "") return false
		if (Array.isArray(value) && !value.length) return false
		return true
	}

	function listParams() {
		const wire = modelColumns.value
		const params: Record<string, unknown> = {
			doctype,
			filters: toFiltersDict((filters.value || []).filter(isComplete)),
			// Clearing every sort rule leaves order_by empty; get_data requires a string.
			order_by: serializeOrderBy(sort.value || []) || "modified desc",
			// How many rows to fetch (grown by Load More), and the page size the footer's
			// buttons show. get_data limits the query by page_length and only echoes
			// page_length_count back — the split is the footer's, not the server's.
			page_length: pageLength.value,
			page_length_count: pageSize.value,
		}
		// Any non-empty `columns`/`rows` makes get_data a "custom view" that returns
		// exactly what it was asked for — so they are sent only once the columns are
		// known, and never as an empty pair (which would still trip the custom-view
		// branch and collapse the table to `name`). `rows` is the field set actually
		// fetched, so every column's key must be in it: that is fetchFields.
		if (wire.length) {
			params.columns = wire
			params.rows = fetchFields(wire)
		}
		return params
	}

	// Resource params are evaluated ONCE, at resource creation, so a `{{ filters }}`
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
	function fetchKey(params: Record<string, unknown>) {
		const wire = (params.columns as { width?: unknown }[]) || []
		return JSON.stringify({ ...params, columns: wire.map(({ width, ...rest }) => rest) })
	}
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
	function setPageSize(size: number) {
		pageSize.value = size
		pageLength.value = size
	}

	function loadMore() {
		pageLength.value += pageSize.value
	}

	let sent = fetchKey(listParams())
	let timer: ReturnType<typeof setTimeout> | undefined
	watch(
		[filters, sort, columns, pageLength],
		() => {
			clearTimeout(timer)
			timer = setTimeout(() => {
				const params = listParams()
				const encoded = fetchKey(params)
				if (encoded === sent) return
				sent = encoded
				listData.submit(params)
			}, 250)
		},
		{ deep: true },
	)
	onScopeDispose(() => clearTimeout(timer))

	// The ColumnSettings model starts empty and the control holds no defaults (ui ADR-0006):
	// the HOST owns them. Ours are Meta's, so seeding waits for Meta — which is also what
	// serializeColumns needs to derive each column's `type`/`align`.
	function seedColumns(fields: any[]) {
		columns.value = defaultColumns(fields)
	}

	// The inverse of toFiltersDict + serializeFilters: wire conditions back into the
	// FilterCondition[] the controls render. parseFilters drops any field absent from Meta,
	// and keeps a LIKE's value verbatim. Our conditions store a `like` value BARE (ui
	// ADR-0005) — serializeFilters re-wraps the %% — so unwrap a fully-wrapped one, else the
	// input would read "%A%" and a re-serialize would double-wrap. A one-sided wildcard
	// ("A%") is a deliberate prefix search and is left alone.
	function toConditions(fields: any[], wire: [string, string, unknown][]) {
		return parseFilters(getFilterableFields(fields, doctype), wire)
			// parseFilters leaves `operator` undefined for a wire operator it doesn't know, which
			// a hand-written URL can easily carry (?status=["nope","Open"]). Dropping the row is
			// not just tidiness: the unwrap below reads c.operator, and one TypeError in setup()
			// takes the WHOLE script down — no refetch, no Create, no delete.
			.filter((c: any) => c.operator)
			.map((c: any) => {
				const value = c.value
				const wrapped =
					typeof value === "string" &&
					c.operator.includes("like") &&
					value.length > 1 &&
					value.startsWith("%") &&
					value.endsWith("%")
				return wrapped ? { ...c, value: value.slice(1, -1) } : c
			})
	}

	// URL filters: one query param per fieldname, in either of two forms — and BOTH have to
	// work, because they are what two different callers write:
	//
	//   ?status=Open            a bare value means EQUALS. The form a person types, and the
	//                           one a link from anywhere else in the app would carry. It is
	//                           also how CRM's own saved views store a plain condition
	//                           ({fieldname: value} — see applyView), so the two readers agree.
	//   ?name=["LIKE","%A%"]    an explicit JSON [operator, value] pair (the format PR
	//                           frappe/crm#1524 uses), for everything `equals` cannot say.
	//
	// They are written into the `filters` VARIABLE, not the resource — so the controls display
	// them and the watch above does the fetching. The query is read LIVE off the router rather
	// than from the `route` on ctx: that one is a snapshot taken when setup() ran, and the URL
	// goes on changing under it (we write it ourselves below, and Back/Forward rewrites it).
	function urlConditions(fields: any[], query: Record<string, unknown>) {
		const filterable = getFilterableFields(fields, doctype)
		const byName = new Map(filterable.map((f: any) => [f.fieldname, f]))
		const wire: [string, string, unknown][] = []
		for (const [fieldname, raw] of Object.entries(query || {})) {
			// repeated params arrive as an array; an empty one (?status=) narrows nothing but
			// would still show an empty row in the Filter control.
			if (typeof raw !== "string" || !raw) continue
			// a param naming no filterable field is not a filter at all (?view=…, ?page=…).
			// parseFilters would drop it anyway — skipping here is what lets everything below
			// assume it HAS a field, and so know the field's type.
			const field = byName.get(fieldname)
			if (field) wire.push([fieldname, ...toWirePair(field, raw)])
		}
		return toConditions(fields, wire)
	}

	// One query param's value -> the [operator, value] the wire wants.
	function toWirePair(field: any, raw: string): [string, unknown] {
		try {
			const parsed = JSON.parse(raw)
			// A STRING head is what tells an explicit pair apart from a bare JSON value that
			// merely looks like one (?tags=["a","b"] is a two-element list, not an operator and
			// an argument). An unrecognised operator is dropped by toConditions, not obeyed.
			if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === "string") {
				return [parsed[0], parsed[1]]
			}
		} catch {
			// not JSON — which is the common case, a bare value
		}
		return ["=", equalsValue(field, raw)]
	}

	// A URL carries no types, so a bare value arrives as a string. That is what get_data wants
	// for every fieldtype but one: parseFilters only surfaces a Check as the Yes/No its control
	// renders when the value is a real boolean, so `?converted=1` would otherwise sit in the
	// filter row as the string "1".
	function equalsValue(field: any, raw: string) {
		if (field.fieldtype !== "Check") return raw
		return ["1", "true", "yes"].includes(raw.toLowerCase())
	}

	// The URL is the source of truth for the narrowing, in BOTH directions — so a link always
	// lands on exactly the list it describes, and the address bar always describes the list you
	// are looking at. Three things make that safe, and all three are properties of the app's
	// router, not of this page:
	//
	//   * the app re-runs a page's setup() on route.PATH changes only (AppContainer watches
	//     `() => route.path`), so writing the QUERY neither remounts the page nor re-enters this
	//     script — the write cannot feed itself back into the read;
	//   * which is also why the read cannot be left to setup(): Back/Forward (and a hand-edited
	//     URL) change the query without changing the path, so NOTHING would re-read it and the
	//     list would sit there showing the old filters under the new URL. Hence the watch;
	//   * `route` on ctx is a snapshot from when setup() ran. The live query is on the router.
	//
	// `currentRoute` is read through BOTH shapes on purpose: Studio hands the router to a script
	// inside a Vue ref, so what arrives is a reactive PROXY of the router — and a reactive proxy
	// unwraps the refs hanging off it. `currentRoute` is therefore the route itself here, not the
	// Ref<Route> vue-router's types promise (reading `.value` off it is undefined, which took the
	// script down). Either way still tracks as a dependency, so the watch below stays reactive.
	const liveRoute = () => ((router.currentRoute as any)?.value ?? router.currentRoute) as any
	const liveQuery = () => (liveRoute()?.query || {}) as Record<string, unknown>
	// Every comparison of two queries below decides whether to WRITE the URL or to RE-READ it, so
	// it has to answer "same narrowing?", not "same object". Key order is not part of that: the
	// router hands the query back in its own order, and a plain stringify would read that as a
	// change — write, re-read, write, for as long as the page is open.
	const stable = (query: Record<string, unknown>) =>
		JSON.stringify(Object.keys(query).sort().map((key) => [key, query[key]]))

	let urlApplied = false
	// What we last put in the address bar ourselves, so the watch below can tell OUR write (which
	// must not re-read, or a `like`'s bare value would round-trip through its %-wrapped form on
	// every keystroke) from someone else's (Back/Forward/paste — which must).
	let written = ""

	// The narrowing can't be read until Meta is in: a wire condition can't become the
	// FilterCondition the control renders without the field it carries.
	watch(
		[metaFields, liveQuery],
		([fields, query]: [any[], Record<string, unknown>]) => {
			if (!fields.length) return
			// Re-reading is the plain list's business: on a saved view the filters come from the
			// VIEW, not from the query (see the syncUrl guard), so there is nothing to re-read.
			if (urlApplied && (currentView || stable(query) === written)) return
			urlApplied = true
			const conditions = urlConditions(fields, query)
			// Guarded: the first read of a URL with no filters at all must not touch `filters`,
			// or it would fire the refetch watch before the guard's own first fetch.
			if (conditions.length || filters.value?.length) filters.value = conditions
		},
		{ immediate: true, deep: true },
	)

	// Only once the URL has been read, though: `filters` starts empty, and an empty mirror would
	// wipe the very query it is about to be seeded from.
	watch(
		filters,
		() => {
			if (urlApplied) syncUrl()
		},
		{ deep: true },
	)

	// What goes in the URL is the wire dict actually SENT to get_data — one param per field, an
	// unfilled row left out — so the link and the query can never disagree.
	function syncUrl() {
		// Only the rendered app owns its address bar. In the builder this same script runs against
		// the BUILDER's router, where a filter clicked on the canvas would otherwise scribble
		// ?status=… onto the editor's own URL.
		if (!(window as any).app_name) return
		// A saved view's URL names the VIEW, and the view — not the query — is what the narrowing
		// comes from (applyView below). Mirroring there would rewrite /view/16 to
		// /view/16?status=Qualified the moment it loaded, and Back would then strip the query and
		// leave the saved view showing everything.
		if (currentView) return

		const query: Record<string, unknown> = {}
		// Every filterable field is this page's to own — so a filter that was REMOVED leaves the
		// URL with it. Anything else a link carried (?view=…) is not ours, and stays untouched.
		const owned = new Set(getFilterableFields(metaFields.value, doctype).map((f: any) => f.fieldname))
		const current = liveQuery()
		for (const [key, value] of Object.entries(current)) {
			if (!owned.has(key)) query[key] = value
		}
		for (const [fieldname, pair] of Object.entries(toFiltersDict((filters.value || []).filter(isComplete)))) {
			query[fieldname] = toQueryValue(pair)
		}

		const encoded = stable(query)
		if (encoded === stable(current)) return
		written = encoded
		// Adding or removing a filter is a discrete act and earns a history entry: Back steps back
		// through the narrowing. Editing a value does not — a filter's value box emits on every
		// keystroke, and an entry per character would make Back useless. Which fields are being
		// filtered is what tells the two apart.
		const structural = Object.keys(query).sort().join() !== Object.keys(current).sort().join()
		if (structural) router.push({ query })
		else router.replace({ query })
	}

	// An `=` is written BARE (?status=Open): it is the form a person can read and edit, it is what
	// urlConditions reads back, and it is the overwhelming majority of filters. Anything else has
	// to spell its operator out as the [operator, value] pair.
	function toQueryValue([operator, value]: [string, unknown]) {
		if (operator !== "=") return JSON.stringify([operator, value])
		// a Check's `=` is a real boolean by here (serializeFilters turns its Yes/No back into
		// one); "1"/"0" is what equalsValue reads back, and what CRM's own URLs carry.
		if (typeof value === "boolean") return value ? "1" : "0"
		return String(value)
	}

	// --- saved views ---------------------------------------------------------------
	// A stored view holds get_data's WIRE shapes: a `filters` dict, an `order_by` string and
	// wire `columns`. get_data does NOT expand a view — passing a view name only affects
	// is_default — so a view is applied CLIENT-SIDE, exactly as CRM's own ViewControls does:
	// parse the row back into the controls' native shapes and let the existing watch refetch.
	// Parsing (rather than shoving the wire shapes at the resource) is what makes a view
	// VISIBLE in Filter/SortBy/ColumnSettings, not merely applied to the query.
	function applyView(view: any, fields: any[]) {
		const wire: [string, string, unknown][] = []
		for (const [fieldname, condition] of Object.entries(JSON.parse(view.filters || "{}"))) {
			// what we store, via toFiltersDict: {fieldname: [operator, value]}. CRM's own
			// frontend also writes a bare {fieldname: value}, which means equals.
			if (Array.isArray(condition) && condition.length === 2) {
				wire.push([fieldname, condition[0] as string, condition[1]])
			} else {
				wire.push([fieldname, "=", condition])
			}
		}
		filters.value = toConditions(fields, wire)
		sort.value = parseOrderBy(view.order_by || "")

		// The view's columns ARE the defaults on this page — but a view saved without any
		// (or a standard view the server synthesised) falls back to Meta's, same as the
		// plain list.
		const viewColumns = JSON.parse(view.columns || "[]")
		if (viewColumns.length) columns.value = parseColumns(viewColumns)
		else seedColumns(fields)

		// The list resource is auto=0 on the saved-view page (its creation params can't see
		// the view: they are evaluated once, against {variables, route, router}), so this is
		// the FIRST fetch, not a refetch — and the debounce watch above then sees the same
		// params and skips.
		const params = listParams()
		sent = fetchKey(params)
		listData.submit(params)
	}

	if (currentView) {
		let viewApplied = false
		// Meta has to be in too: a wire condition can't become a FilterCondition without the
		// field it carries.
		watch(
			[metaFields, () => currentView.data],
			([fields, view]: [any[], any]) => {
				if (viewApplied || !fields.length || !view) return
				viewApplied = true
				applyView(view, fields)
			},
			{ immediate: true },
		)
	}

	// Nothing above has fetched anything: both resources are auto=0, and the guard fires the
	// first one only once the server confirms the route names a real, listable doctype (and
	// that the URL is already the canonical spelling of it — otherwise it redirects there and
	// this setup runs again). A typo therefore costs exactly one request, not a failed
	// get_data for a doctype that doesn't exist.
	guardDoctype(() => {
		// safe now: the route names a real doctype, in its canonical spelling
		loadMeta(doctype)
		if (currentView) {
			// The saved-view page: its creation params (doctype + viewName, both from the
			// route) are correct, so a bare fetch() is right — applyView then fires the list.
			currentView.fetch()
			return
		}
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
			(fields: any[]) => {
				if (started || !fields.length) return
				started = true
				seedColumns(fields)
				const params = listParams()
				sent = fetchKey(params)
				listData.submit(params)
			},
			{ immediate: true },
		)
	}, viewName ? `/view/${viewName}` : "")

	// The picker. Its rows are the `views` variable the sidebar's snippet fetched (grouped by
	// doctype) — one fetch feeds both the sidebar and this. Switching a view is a plain route
	// change: Studio re-runs the page's setup on every navigation, so the new view loads itself.
	const doctypeViews = computed(() => (views.value || {})[doctype] || [])

	const viewLabel = computed(() => {
		if (!viewName) return "Default view"
		const row = doctypeViews.value.find((v: any) => String(v.name) === String(viewName))
		return row?.label || currentView?.data?.label || "View"
	})

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
		{
			group: "Views",
			options: [
				{ label: "Default view", onClick: () => router.push(`/${encodeURIComponent(route.params.doctype)}`) },
				...doctypeViews.value.map((view: any) => ({
					label: view.label,
					onClick: () => router.push(`/${encodeURIComponent(route.params.doctype)}/view/${view.name}`),
				})),
			],
		},
		{
			group: "Actions",
			hideLabel: true,
			options: [
				{
					label: "Save view",
					icon: "lucide-plus",
					onClick: () => {
						viewDialog.value = true
					},
				},
			],
		},
	])

	// The toolbar's "..." menu: what you do TO the controls, as opposed to what you do WITH
	// them. QuickFilter owns its edit mode through a `customizing` v-model it deliberately
	// leaves to the host — so this is the trigger, and the control itself draws the chip
	// editor and its Done button in place of the inputs.
	const controlOptions = computed(() => [
		{
			label: "Customize Quick Filter",
			icon: "lucide-sliders-horizontal",
			onClick: () => {
				customizing.value = true
			},
		},
	])

	// "Create view": the current control state, saved. listParams() is already exactly what a
	// view row stores (filters dict / order_by / columns / rows), so the state travels as-is.
	async function createView() {
		const label = (newViewLabel.value || "").trim()
		if (!label) return
		const params = listParams() as any
		// create_or_update_view takes the view's doctype as `doctype` (NOT `dt`), and its JSON
		// fields as strings. With no `name` and no `is_standard` it routes to create().
		const view = await call(
			"crm.fcrm.doctype.crm_view_settings.crm_view_settings.create_or_update_view",
			{
				view: {
					label,
					type: "list",
					doctype,
					filters: JSON.stringify(params.filters || {}),
					order_by: params.order_by,
					columns: JSON.stringify(params.columns || []),
					rows: JSON.stringify(params.rows || []),
				},
			},
		)
		viewDialog.value = false
		newViewLabel.value = ""
		// CRM View Settings is autoincrement, so `name` is an int — the view's URL.
		router.push(`/${encodeURIComponent(route.params.doctype)}/view/${view.name}`)
	}

	const createViewActions = computed(() => [
		{
			label: "Create",
			variant: "solid",
			disabled: !(newViewLabel.value || "").trim(),
			onClick: createView,
		},
	])

	// --- the header ------------------------------------------------------------------
	// The curated doctypes have a nicer plural ("Leads"); anything else — and any doctype
	// can be reached by URL — shows as its own name. Same fallback as the detail page.
	const doctypeLabel = computed(() => doctypeLabels[doctype] || doctype)

	// One crumb: the list itself. The VIEW is the second crumb, and it is a Dropdown rather
	// than a Breadcrumbs item (an item is a link, not a picker) — so the block tree draws it
	// next to the "/" separator instead. See build_page.
	const breadcrumbs = computed(() => [
		{ label: doctypeLabel.value, route: `/${encodeURIComponent(route.params.doctype)}` },
	])

	// --- create ------------------------------------------------------------------------
	// "Create" opens a quick-entry dialog: CRM's "Quick Entry" layout for the route's
	// doctype, handed to the same FormLayout the detail page uses. get_fields_layout
	// synthesizes a layout for a doctype that has none, so this stays as generic as the
	// rest of the page — nothing per-doctype is registered anywhere.
	// The doctype's own name, not the sidebar's plural: "New CRM Lead", never "New Leads".
	const createTitle = `New ${doctype}`

	function openCreate() {
		// A fresh blank doc each time: FormLayout edits this object in place, so reusing the
		// last one would pre-fill the form with an abandoned draft.
		newDoc.value = {}
		createError.value = ""
		// The layout is fetched on the FIRST open, not with the page: a user who only browses
		// the list never pays for it. Its creation params (the route's doctype) are already
		// right, so a bare fetch() is correct here.
		if (!createLayout.data && !createLayout.loading) createLayout.fetch()
		createDialog.value = true
	}

	async function createDoc() {
		if (creating.value) return
		creating.value = true
		createError.value = ""
		try {
			// The same insert CRM's own frontend does — no CRM-specific endpoint needed. The
			// server enforces mandatory fields and permissions; a missing one throws, and the
			// dialog stays open showing why.
			const doc = await call("frappe.client.insert", { doc: { doctype, ...(newDoc.value || {}) } })
			createDialog.value = false
			toast.success(`${doctype} created`)
			// Straight into the new record, where the full form is.
			router.push(`/${encodeURIComponent(route.params.doctype)}/${encodeURIComponent(doc.name)}`)
		} catch (error: any) {
			createError.value = errorMessage(error)
		} finally {
			creating.value = false
		}
	}

	const createActions = computed(() => [
		{ label: "Create", variant: "solid", loading: creating.value, onClick: createDoc },
	])

	// frappe-ui's `call` rejects with the server messages attached (e.g. "Value missing for
	// CRM Lead: First Name"); never swallow them.
	function errorMessage(error: any) {
		if (error?.messages?.length) return error.messages.join("\n")
		return error?.message || "Something went wrong"
	}

	// ─── Bulk delete ────────────────────────────────────────────────────────────────────
	// `selection` is the two-way variable CrmListView holds the ticked rows in (their docnames).
	// Reading it is how Delete knows what to delete; writing [] is how the selection is CLEARED
	// — the component turns that into ListView's own toggleAllRows, which is the only thing that
	// can move a Set ListView owns.
	const deleteTitle = computed(() =>
		selection.value.length === 1 ? "Delete 1 record?" : `Delete ${selection.value.length} records?`,
	)

	// The banner's buttons (CrmListView renders them into ListSelectBanner's actions slot).
	// Delete only opens the confirm dialog — nothing is destroyed on this click.
	const bulkActions = computed(() => [
		{ label: "Delete", theme: "red", onClick: () => (deleteDialog.value = true) },
	])

	// A refetch replaces the rows under a selection the component would otherwise keep: filter
	// something out while it's ticked and it stays selected but invisible, and Delete would then
	// hit records the user can't see. The selection means "these rows, the ones in front of
	// you", so it is dropped whenever the list is re-fetched.
	watch(() => listData.data, () => (selection.value = []))

	async function deleteSelected() {
		const items = selection.value
		if (!items.length) return
		deleting.value = true
		deleteError.value = ""
		try {
			await call("crm.api.doc.delete_bulk_docs", { doctype, items })
			deleteDialog.value = false
			// Over 10 records the server ENQUEUES the delete (crm.api.doc.delete_bulk_docs) and
			// returns straight away, so the rows are still there on the next fetch. Say that,
			// rather than showing a list that looks like the delete silently failed.
			toast.success(
				items.length > 10
					? `Deleting ${items.length} records in the background`
					: `Deleted ${items.length} record${items.length === 1 ? "" : "s"}`,
			)
			selection.value = []
			listData.submit(listParams())
		} catch (error: any) {
			// The dialog stays open, holding the reason — a delete blocked by a link ("Cannot
			// delete because it is linked with…") or by permission is exactly what to show.
			deleteError.value = errorMessage(error)
		} finally {
			deleting.value = false
		}
	}

	const deleteActions = computed(() => [
		{
			label: "Delete",
			variant: "solid",
			theme: "red",
			loading: deleting.value,
			onClick: deleteSelected,
		},
	])

	// Exposed to the block expressions. `wireColumns` is the ColumnSettings model in the
	// table's render shape (see modelColumns) — the control's state, not the response's.
	//
	// This return is now the page's whole surface: the state declared at the top has to come
	// back out through it, exactly as the computeds and handlers do, or the blocks binding it
	// by name would read `undefined`. The refs are returned AS refs — a `{{ }}` read unwraps
	// them, and a two-way `$type: variable` prop needs the ref itself to write through.
	return {
		// State the block tree binds by name. The first eleven are bound two-way.
		filters,
		sort,
		columns,
		viewDialog,
		newViewLabel,
		customizing,
		createDialog,
		newDoc,
		selection,
		pageSize,
		deleteDialog,
		views,
		doctypeLabels,
		creating,
		createError,
		pageLength,
		deleting,
		deleteError,

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
		// The footer's two buttons, alongside the `pageSize` above that they move.
		loadMore,
		setPageSize,
		bulkActions,
		deleteTitle,
		deleteActions,
	}
}

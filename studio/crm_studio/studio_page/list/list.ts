// List page: the toolbar's four controls hold the narrowing, the ordering and the shown
// columns in @framework/ui's own shapes (FilterCondition[] / Sort[] / Column[]). Nothing
// else does — the controls never fetch. This script is the only place those shapes are
// translated into what `crm.api.doc.get_data` takes, and the only thing that refetches.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources
// by name, its variables as refs, and route/router. What it RETURNS is exposed to the
// block expressions ({{ wireColumns }}), which is how the table repaints the instant
// ColumnSettings changes, without waiting for the refetch.
import { computed, getCurrentScope, onScopeDispose, ref, watch } from "vue"
import { call, toast } from "frappe-ui"
// The controls ship the wire translation as pure helpers; the page script is compiled
// into the app bundle by studio's vite, which aliases @framework/ui — so reuse them
// rather than re-deriving the operator / column tables.
import { useDoctypeMeta } from "@framework/ui"
import { getFilterableFields, parseFilters, serializeFilters } from "@framework/ui/Filter"
import { parseOrderBy, serializeOrderBy } from "@framework/ui/SortBy"
import {
	fetchFields,
	getDefaultColumns,
	parseColumns,
	serializeColumns,
} from "@framework/ui/ColumnSettings"

export default function setup(ctx: any) {
	const { listData, filters, sort, columns, route, router } = ctx
	// `views` is not destructured here — the sidebar's snippet below already declares it
	// (it owns the fetch), and this script shares that one scope.
	const { viewDialog, newViewLabel, customizing } = ctx
	const { createLayout, doctypeLabels, createDialog, newDoc, creating, createError } = ctx
	// The route carries the doctype name itself ("CRM Lead"), already decoded by vue-router.
	const doctype = route.params.doctype
	// Only the saved-view page declares this resource, and only it has a :viewName.
	const currentView = ctx.currentView
	const viewName = route.params.viewName

	// The sidebar's collapsed state has to outlive the page: Studio remounts the page (and
	// the CRMSidebar component with it) on every navigation, so the `sidebarCollapsed`
	// variable backing Sidebar's `collapsed` v-model resets. localStorage is the only place
	// it can survive — rehydrate it here, persist it on every toggle.
	const { sidebarCollapsed } = ctx
	sidebarCollapsed.value = localStorage.getItem("crm-studio:sidebar-collapsed") === "true"
	watch(sidebarCollapsed, (collapsed: boolean) => {
		localStorage.setItem("crm-studio:sidebar-collapsed", collapsed ? "true" : "false")
	})

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `views` variable the
	// component renders. The list page's view picker reads the same variable: one fetch, one
	// source of truth. The call goes through `ctx.call` (Studio puts frappe-ui's `call` in
	// every script's context) rather than an import, because the pages' scripts share no set
	// of static imports — the home page imports nothing from frappe-ui.
	const { views } = ctx
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
			page_length: 20,
			page_length_count: 20,
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
	let sent = JSON.stringify(listParams())
	let timer: ReturnType<typeof setTimeout> | undefined
	watch(
		[filters, sort, columns],
		() => {
			clearTimeout(timer)
			timer = setTimeout(() => {
				const params = listParams()
				const encoded = JSON.stringify(params)
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
		return parseFilters(getFilterableFields(fields, doctype), wire).map((c: any) => {
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

	// URL filters (the format PR frappe/crm#1524 uses): one query param per fieldname
	// whose value is a JSON [operator, value] pair, e.g. ?name=["LIKE","%A%"]. They are
	// written into the `filters` VARIABLE, not the resource — so the controls display
	// them and the watch above does the fetching. Deliberately one-way: filter changes
	// are not pushed back into the URL, both because the ticket doesn't ask for it and
	// because Studio re-runs a page's setup on `route.path` (not query) changes, so a
	// self-inflicted query churn would be silently ignored anyway.
	function urlConditions(fields: any[]) {
		const wire: [string, string, unknown][] = []
		for (const [fieldname, raw] of Object.entries(route.query || {})) {
			if (typeof raw !== "string") continue
			try {
				const pair = JSON.parse(raw)
				if (Array.isArray(pair) && pair.length === 2) wire.push([fieldname, pair[0], pair[1]])
			} catch {
				// not a filter param (?view=..., ?page=...) — ignore it
			}
		}
		return toConditions(fields, wire)
	}

	let urlApplied = false
	watch(
		metaFields,
		(fields: any[]) => {
			if (urlApplied || !fields.length) return
			urlApplied = true
			const conditions = urlConditions(fields)
			if (conditions.length) filters.value = conditions
		},
		{ immediate: true },
	)

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
		sent = JSON.stringify(params)
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
				sent = JSON.stringify(params)
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
	const doctypeLabel = computed(() => doctypeLabels.value[doctype] || doctype)

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

	// Exposed to the block expressions. `wireColumns` is the ColumnSettings model in the
	// table's render shape (see modelColumns) — the control's state, not the response's.
	return {
		wireColumns: modelColumns,
		breadcrumbs,
		viewLabel,
		viewOptions,
		controlOptions,
		createViewActions,
		createTitle,
		createActions,
		openCreate,
	}
}

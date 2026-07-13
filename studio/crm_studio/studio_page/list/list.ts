// List page: the toolbar's four controls hold the narrowing, the ordering and the shown
// columns in @framework/ui's own shapes (FilterCondition[] / Sort[] / Column[]). Nothing
// else does — the controls never fetch. This script is the only place those shapes are
// translated into what `crm.api.doc.get_data` takes, and the only thing that refetches.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources
// by name, its variables as refs, and route/router. What it RETURNS is exposed to the
// block expressions ({{ wireColumns }}), which is how the table repaints the instant
// ColumnSettings changes, without waiting for the refetch.
import { computed, onScopeDispose, watch } from "vue"
import { call } from "frappe-ui"
// The controls ship the wire translation as pure helpers; the page script is compiled
// into the app bundle by studio's vite, which aliases @framework/ui — so reuse them
// rather than re-deriving the operator / column tables.
import { useDoctypeMeta } from "@framework/ui"
import { getFilterableFields, parseFilters, serializeFilters } from "@framework/ui/Filter"
import { parseOrderBy, serializeOrderBy } from "@framework/ui/SortBy"
import { fetchFields, parseColumns, serializeColumns } from "@framework/ui/ColumnSettings"

export default function setup(ctx: any) {
	const { listData, filters, sort, columns, doctypeMap, route, router } = ctx
	// `views` is not destructured here — the sidebar's snippet below already declares it
	// (it owns the fetch), and this script shares that one scope.
	const { viewDialog, newViewLabel } = ctx
	const doctype = doctypeMap.value[route.params.doctype]
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
	const VIEW_SLUGS: Record<string, string> = {"CRM Lead": "crm-lead", "CRM Deal": "crm-deal", "Contact": "contact", "CRM Organization": "crm-organization", "CRM Task": "crm-task", "FCRM Note": "fcrm-note"}
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {
		// Grouped by doctype, and carrying the slug: both the sidebar row and the picker
		// route by slug (`/:doctype/view/:viewName`), and a stored view only knows its `dt`.
		const grouped: Record<string, any[]> = {}
		for (const row of rows || []) {
			const slug = VIEW_SLUGS[row.dt]
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!slug || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), { ...row, slug }]
		}
		views.value = grouped
	})

	// Meta is fetched once per doctype and shared with the controls (same memoised
	// composable). Two translations need it: Column[] -> wire columns, and the URL's
	// wire filters -> FilterCondition[] (which carry their field's Meta).
	const { meta } = useDoctypeMeta(doctype)
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
		() => (modelColumns.value.length ? modelColumns.value : listData.data?.columns) || [],
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

	// The ColumnSettings model starts empty and the control holds no defaults (ui
	// ADR-0006): the HOST owns them, and the doctype's defaults are exactly what the
	// first (default-view) response came back with. Seed them once, in Column[] shape.
	// Meta has to be in before seeding: serializeColumns derives `type`/`align` from it,
	// so seeding earlier would leave `sent` describing meta-less columns, and Meta landing
	// a moment later would look like a real change and refire the fetch.
	let seeded = false
	watch(
		[() => listData.data?.columns, metaFields],
		([wire, fields]: [any[], any[]]) => {
			if (seeded || !wire?.length || !fields.length) return
			seeded = true
			// The server just returned these columns, so echoing them back is a no-op
			// fetch: adopt them into `sent` instead of firing one. Unless something else
			// (a URL filter) already moved the params — then the pending submit must
			// still go out, now carrying the columns too, so `sent` is left alone.
			const unchanged = JSON.stringify(listParams()) === sent
			columns.value = parseColumns(wire)
			if (unchanged) sent = JSON.stringify(listParams())
		},
		{ immediate: true },
	)

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

		const viewColumns = JSON.parse(view.columns || "[]")
		if (viewColumns.length) {
			columns.value = parseColumns(viewColumns)
			// The view's columns ARE the defaults on this page — don't let the response's
			// columns seed over them.
			seeded = true
		}

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

	// The picker. Its rows are the `views` variable the sidebar's snippet fetched (grouped by
	// doctype) — one fetch feeds both the sidebar and this. Switching a view is a plain route
	// change: Studio re-runs the page's setup on every navigation, so the new view loads itself.
	const doctypeViews = computed(() => (views.value || {})[doctype] || [])

	const viewLabel = computed(() => {
		if (!viewName) return "Default view"
		const row = doctypeViews.value.find((v: any) => String(v.name) === String(viewName))
		return row?.label || currentView?.data?.label || "View"
	})

	const viewOptions = computed(() => [
		{ label: "Default view", onClick: () => router.push(`/${route.params.doctype}`) },
		...doctypeViews.value.map((view: any) => ({
			label: view.label,
			onClick: () => router.push(`/${route.params.doctype}/view/${view.name}`),
		})),
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
		router.push(`/${route.params.doctype}/view/${view.name}`)
	}

	const createViewActions = computed(() => [
		{
			label: "Create",
			variant: "solid",
			disabled: !(newViewLabel.value || "").trim(),
			onClick: createView,
		},
	])

	// Exposed to the block expressions: the table renders `wireColumns`, not the response's
	// columns, so adding/removing a column repaints immediately (the matching refetch then
	// fills the new column's cells).
	return { wireColumns, viewLabel, viewOptions, createViewActions }
}

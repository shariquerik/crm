// The saved views a list offers: the picker in the header, applying the one the route names,
// and saving the current state as a new one.
import { computed, ref, watch, type Ref } from "vue"
import { call } from "frappe-ui"
import { parseColumns } from "@framework/ui/ColumnSettings"
import { parseOrderBy } from "@framework/ui/SortBy"
import { fetchViews } from "@app/data/doctypes"
import { toConditions } from "@app/data/listWire"

export function useSavedViews(options: {
	ctx: any
	doctype: string
	viewName: string
	currentView: any
	filters: Ref<any[]>
	sort: Ref<any[]>
	columns: Ref<any[]>
	metaFields: Ref<any[]>
	seedColumns: (fields: any[]) => void
	listParams: () => Record<string, unknown>
	submit: () => void
}) {
	const { ctx, doctype, viewName, currentView, filters, sort, columns } = options
	const { metaFields, seedColumns, listParams, submit } = options
	const { route, router } = ctx

	const views = fetchViews(ctx)
	const viewDialog = ref(false)
	const newViewLabel = ref("")

	if (currentView) {
		let viewApplied = false
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

	// get_data does NOT expand a view — passing a view name only affects is_default — so a
	// view is applied client-side, exactly as CRM's own ViewControls does. Parsing it back
	// into the controls' native shapes is what makes a view VISIBLE in the toolbar rather
	// than merely applied to the query.
	function applyView(view: any, fields: any[]) {
		const wire: [string, string, unknown][] = []
		for (const [fieldname, condition] of Object.entries(JSON.parse(view.filters || "{}"))) {
			// what we store is {fieldname: [operator, value]}; CRM's own frontend also writes
			// a bare {fieldname: value}, which means equals
			if (Array.isArray(condition) && condition.length === 2) {
				wire.push([fieldname, condition[0] as string, condition[1]])
			} else {
				wire.push([fieldname, "=", condition])
			}
		}
		filters.value = toConditions(doctype, fields, wire)
		sort.value = parseOrderBy(view.order_by || "")

		const viewColumns = JSON.parse(view.columns || "[]")
		if (viewColumns.length) columns.value = parseColumns(viewColumns)
		else seedColumns(fields)

		// The list resource is auto=0 on the saved-view page, so this is the FIRST fetch, not
		// a refetch — the debounce watch then sees the same params and skips.
		submit()
	}

	const doctypeViews = computed(() => (views.value || {})[doctype] || [])

	const viewLabel = computed(() => {
		if (!viewName) return "Default view"
		const row = doctypeViews.value.find((v: any) => String(v.name) === String(viewName))
		return row?.label || currentView?.data?.label || "View"
	})

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

	// listParams() is already exactly what a view row stores, so the state travels as-is.
	async function createView() {
		const label = (newViewLabel.value || "").trim()
		if (!label) return
		const params = listParams() as any
		// create_or_update_view takes the view's doctype as `doctype` (not `dt`), and its
		// JSON fields as strings. With no `name` and no `is_standard` it routes to create().
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
		// CRM View Settings is autoincrement, so `name` is an int — the view's URL
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

	return { views, viewDialog, newViewLabel, viewLabel, viewOptions, createViewActions }
}

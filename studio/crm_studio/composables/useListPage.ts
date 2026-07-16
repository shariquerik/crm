// The list screen, shared by the plain list page (/:doctype) and the saved-view page
// (/:doctype/view/:viewName). The two differ only by ctx.currentView: when it is present
// the narrowing comes from the stored view rather than from the URL.
//
// The toolbar's four controls hold the narrowing, the ordering and the shown columns in
// @framework/ui's own shapes (FilterCondition[] / Sort[] / Column[]) — the controls never
// fetch. This wires them to the pieces that do: useListQuery is the only thing that
// refetches, useUrlFilters mirrors the narrowing to the address bar.
import { computed, getCurrentScope, ref, watch } from "vue"
import { useDoctypeMeta } from "@framework/ui"
import { applyColumnWidth, clearColumnWidth, getDefaultColumns } from "@framework/ui/ColumnSettings"
import { doctypeLabels, guardDoctype } from "@app/data/doctypes"
import { useBulkDelete } from "@app/composables/useBulkDelete"
import { useCreateDoc } from "@app/composables/useCreateDoc"
import { useListQuery, usePaging } from "@app/composables/useListQuery"
import { useSavedViews } from "@app/composables/useSavedViews"
import { useUrlFilters } from "@app/composables/useUrlFilters"

const GENERIC_COLUMNS = [
	{ fieldname: "name", label: "Name" },
	{ fieldname: "modified", label: "Last Modified" },
]

export function useListPage(ctx: any) {
	const { listData, createLayout, route, router } = ctx

	const filters = ref<any[]>([])
	const sort = ref<any[]>([{ fieldname: "modified", direction: "desc" }])
	const columns = ref<any[]>([])
	const customizing = ref(false)
	const pageSize = ref(20)
	const pageLength = ref(20)

	// The route carries the doctype name itself ("CRM Lead"), already decoded by vue-router.
	const doctype = route.params.doctype
	const currentView = ctx.currentView
	const viewName = route.params.viewName

	const { metaFields, titleField, loadMeta } = useMeta()

	// Defaults come from Meta, deliberately not from the response's `columns`: those are the
	// controller's `default_list_data()`, and a doctype that returns `{"columns": []}` (FCRM
	// Note does — CRM renders notes as cards) would paint a headerless grid over real rows.
	function seedColumns(fields: any[]) {
		// copied, because this becomes `columns`, which a resize mutates in place
		if (!fields.some((f: any) => f.in_list_view)) {
			columns.value = GENERIC_COLUMNS.map((column) => ({ ...column }))
			return
		}
		columns.value = getDefaultColumns(fields, titleField.value)
	}

	// A width IS the column model: frappe-ui's getGridTemplateColumns turns it into the
	// grid's track, and it is what a saved view stores.
	function resizeColumn(key: string, width: string) {
		columns.value = applyColumnWidth(columns.value || [], key, width)
	}

	function resetColumnWidth(key: string) {
		columns.value = clearColumnWidth(columns.value || [], key)
	}

	const query = useListQuery({ listData, doctype, filters, sort, columns, metaFields, pageSize, pageLength })
	const { setPageSize, loadMore } = usePaging(pageSize, pageLength)

	useUrlFilters({ filters, metaFields, doctype, currentView, router })

	const savedViews = useSavedViews({
		ctx,
		doctype,
		viewName,
		currentView,
		filters,
		sort,
		columns,
		metaFields,
		seedColumns,
		listParams: query.listParams,
		submit: query.submit,
	})

	// Nothing above has fetched: both resources are auto=0, and the guard fires the first
	// only once the server confirms the route names a real, listable doctype. A typo
	// therefore costs exactly one request.
	guardDoctype(
		ctx,
		() => {
			loadMeta(doctype)
			if (currentView) {
				// its creation params (doctype + viewName) come from the route, so a bare
				// fetch() is right — applyView then fires the list
				currentView.fetch()
				return
			}
			startPlainList()
		},
		viewName ? `/view/${viewName}` : "",
	)

	// The plain list waits for Meta before its FIRST fetch, because the default columns come
	// from Meta: firing earlier would send a column-less request whose answer we'd throw away
	// the moment Meta seeded the columns.
	//
	// A flag, not the watcher's stop handle: useDoctypeMeta is memoised per doctype, so on a
	// revisit `immediate` runs this synchronously while `stop` is still in its TDZ. It also
	// keeps a later Meta reload from re-seeding changed columns.
	function startPlainList() {
		let started = false
		watch(
			metaFields,
			(fields: any[]) => {
				if (started || !fields.length) return
				started = true
				seedColumns(fields)
				query.submit()
			},
			{ immediate: true },
		)
	}

	const createDoc = useCreateDoc({ createLayout, doctype, route, router })
	const bulkDelete = useBulkDelete({ listData, doctype, submit: query.submit })

	// QuickFilter owns its edit mode through a `customizing` v-model it leaves to the host,
	// so this is the trigger; the control draws the chip editor in place of the inputs.
	const controlOptions = computed(() => [
		{
			label: "Customize Quick Filter",
			icon: "lucide-sliders-horizontal",
			onClick: () => {
				customizing.value = true
			},
		},
	])

	// One crumb: the list itself. The VIEW is the second, and it is a Dropdown rather than a
	// Breadcrumbs item (an item is a link, not a picker), so the block tree draws it next to
	// the "/" separator instead.
	const breadcrumbs = computed(() => [
		{
			label: doctypeLabels[doctype] || doctype,
			route: `/${encodeURIComponent(route.params.doctype)}`,
		},
	])

	// The page's whole surface. Refs are returned AS refs — a `{{ }}` read unwraps them, and
	// a two-way `$type: variable` prop needs the ref itself to write through.
	return {
		filters,
		sort,
		columns,
		customizing,
		pageSize,
		pageLength,
		doctypeLabels,

		wireColumns: query.wireColumns,
		breadcrumbs,
		controlOptions,
		resizeColumn,
		resetColumnWidth,
		loadMore,
		setPageSize,
		...savedViews,
		...createDoc,
		...bulkDelete,
	}
}

// scope.run() keeps the watcher inside THIS page's effect scope, so it is still disposed on
// navigation — calling useDoctypeMeta bare from a watch callback would leak it, since the
// scope is only active during setup's synchronous run.
function useMeta() {
	const scope = getCurrentScope()
	const metaFields = ref<any[]>([])
	const titleField = ref<string>("")

	function loadMeta(doctype: string) {
		const run = () => {
			const { meta } = useDoctypeMeta(doctype)
			watch(
				meta,
				(loaded: any) => {
					titleField.value = loaded?.title_field || ""
					metaFields.value = loaded?.fields ?? []
				},
				{ immediate: true },
			)
		}
		scope ? scope.run(run) : run()
	}

	return { metaFields, titleField, loadMeta }
}

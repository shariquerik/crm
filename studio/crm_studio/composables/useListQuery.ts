// The list's query: what the controls' state means to `crm.api.doc.get_data`, and the only
// thing that refetches. Owns paging, because a page size is part of that question.
import { computed, onScopeDispose, watch, type Ref } from "vue"
import { fetchFields, serializeColumns } from "@framework/ui/ColumnSettings"
import { serializeOrderBy } from "@framework/ui/SortBy"
import { completeFilters, fetchKey, toFiltersDict } from "@app/data/listWire"

const REFETCH_DEBOUNCE_MS = 250

export function useListQuery(options: {
	listData: any
	doctype: string
	filters: Ref<any[]>
	sort: Ref<any[]>
	columns: Ref<any[]>
	metaFields: Ref<any[]>
	pageSize: Ref<number>
	pageLength: Ref<number>
}) {
	const { listData, doctype, filters, sort, columns, metaFields, pageSize, pageLength } = options

	// Both what the table renders and what the query asks for, so a column added or removed
	// in ColumnSettings repaints ahead of the refetch that fills its cells.
	const wireColumns = computed(() =>
		(columns.value || []).length ? serializeColumns(columns.value, metaFields.value) : [],
	)

	function listParams() {
		const wire = wireColumns.value
		const params: Record<string, unknown> = {
			doctype,
			filters: toFiltersDict(completeFilters(filters.value)),
			// clearing every sort rule leaves order_by empty; get_data requires a string
			order_by: serializeOrderBy(sort.value || []) || "modified desc",
			page_length: pageLength.value,
			page_length_count: pageSize.value,
		}
		// Any non-empty columns/rows makes get_data a "custom view" returning exactly what it
		// was asked for — so send them only once known, and never as an empty pair, which
		// would still trip that branch and collapse the table to `name`.
		if (wire.length) {
			params.columns = wire
			params.rows = fetchFields(wire)
		}
		return params
	}

	// Resource params are evaluated once, at creation, so a bound `{{ filters }}` would never
	// re-evaluate. The refetch is driven from here: submit(params) replaces the params and
	// re-runs the call.
	let sent = fetchKey(listParams())

	// Unconditional, for a caller that knows the answer is stale even when the question is
	// unchanged (a first fetch, a refresh after a delete).
	function submit() {
		const params = listParams()
		sent = fetchKey(params)
		listData.submit(params)
	}

	// Debounced, because a filter's value box emits on every keystroke.
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
			}, REFETCH_DEBOUNCE_MS)
		},
		{ deep: true },
	)
	onScopeDispose(() => clearTimeout(timer))

	return { wireColumns, listParams, submit }
}

// A page SIZE is a new page, not more of the old one, so the running total goes back down
// to it — set unconditionally rather than watched, because after three Load Mores at 20
// you are showing 60 rows with the size still 20, and clicking that same "20" has to take
// you back to 20.
export function usePaging(pageSize: Ref<number>, pageLength: Ref<number>) {
	function setPageSize(size: number) {
		pageSize.value = size
		pageLength.value = size
	}

	function loadMore() {
		pageLength.value += pageSize.value
	}

	return { setPageSize, loadMore }
}

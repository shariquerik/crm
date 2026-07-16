// The list's query: what the controls' state means to `crm.api.doc.get_data`, and the only thing
// that refetches. Owns paging, because a page size is part of that question.
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
		// Any non-empty columns/rows makes get_data a "custom view" returning exactly what it was
		// asked for — so never send an empty pair, which trips that branch and collapses the
		// table to `name`.
		if (wire.length) {
			params.columns = wire
			params.rows = fetchFields(wire)
		}
		return params
	}

	// Resource params are evaluated once, at creation, so a bound `{{ filters }}` would never
	// re-evaluate. The refetch is driven from here instead: submit() replaces the params.
	let sent = fetchKey(listParams())

	function submit() {
		const params = listParams()
		sent = fetchKey(params)
		listData.submit(params)
	}

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

// A page SIZE is a new page, not more of the old one, so the running total goes back down to it:
// after three Load Mores at 20 you show 60 rows, and clicking that same "20" has to return 20.
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

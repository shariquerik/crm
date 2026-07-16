import { computed, onScopeDispose, watch, type Ref } from 'vue'
import { fetchFields, serializeColumns } from '@framework/ui/ColumnSettings'
import { serializeOrderBy } from '@framework/ui/SortBy'
import { completeFilters, fetchKey, toFiltersDict } from '@app/data/listWire'

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
  const {
    listData,
    doctype,
    filters,
    sort,
    columns,
    metaFields,
    pageSize,
    pageLength,
  } = options

  const wireColumns = computed(() =>
    (columns.value || []).length
      ? serializeColumns(columns.value, metaFields.value)
      : [],
  )

  function listParams() {
    const wire = wireColumns.value
    const params: Record<string, unknown> = {
      doctype,
      filters: toFiltersDict(completeFilters(filters.value)),
      order_by: serializeOrderBy(sort.value || []) || 'modified desc',
      page_length: pageLength.value,
      page_length_count: pageSize.value,
    }
    if (wire.length) {
      params.columns = wire
      params.rows = fetchFields(wire)
    }
    return params
  }

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

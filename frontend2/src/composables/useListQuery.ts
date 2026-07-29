import { computed, onScopeDispose, watch, type Ref } from 'vue'
import {
  fetchFields,
  serializeColumns,
} from '@framework/ui/components/ColumnSettings'
import { serializeOrderBy } from '@framework/ui/components/SortBy'
import { completeFilters, toFiltersDict } from '@/data/listWire'
import { firstRows, listCache } from '@/data/cache/queryCache'
import { cacheKey, fetchKey } from '@/data/cache/queryKey'

const REFETCH_DEBOUNCE_MS = 250

export function useListQuery(options: {
  listData: any
  doctype: string
  routePath: string
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
    routePath,
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

  function fetchRows(params: Record<string, unknown>) {
    const key = cacheKey(params)
    const cached = listCache.read(key)
    if (cached) listData.setData(firstRows(cached.response, pageLength.value))
    listData.submit(params, {
      onSuccess: (response: unknown) => {
        listCache.write(key, { response, columns: wireColumns.value }, doctype)
        listCache.remember(routePath, key)
      },
    })
  }

  function submit() {
    const params = listParams()
    sent = fetchKey(params)
    fetchRows(params)
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
        fetchRows(params)
      }, REFETCH_DEBOUNCE_MS)
    },
    { deep: true },
  )
  onScopeDispose(() => clearTimeout(timer))

  return { wireColumns, submit }
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

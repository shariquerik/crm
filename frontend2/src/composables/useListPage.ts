import { computed, getCurrentScope, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDoctypeMeta } from '@framework/ui'
import {
  applyColumnWidth,
  clearColumnWidth,
  getDefaultColumns,
} from '@framework/ui/components/ColumnSettings'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { firstRows, listCache } from '@/data/cache/queryCache'
import { useBulkDelete } from '@/composables/useBulkDelete'
import { useCreateDoc } from '@/composables/useCreateDoc'
import { useListQuery, usePaging } from '@/composables/useListQuery'
import { useRestoredRef } from '@/composables/usePageState'
import { useViewState } from '@/composables/useViewState'

const GENERIC_COLUMNS = [
  { fieldname: 'name', label: 'Name' },
  { fieldname: 'modified', label: 'Last Modified' },
]

export function useListPage(resources: any) {
  const { listData, createLayout } = resources
  const route = useRoute()
  const router = useRouter()

  const filters = ref<any[]>([])
  const sort = ref<any[]>([{ fieldname: 'modified', direction: 'desc' }])
  const columns = ref<any[]>([])
  const customizing = ref(false)
  const pageSize = useRestoredRef('pageSize', 20)
  const pageLength = useRestoredRef('pageLength', 20)

  const doctype = route.params.doctype
  const viewName = route.params.viewName

  const { metaFields, titleField, loadMeta } = useMeta()

  function seedColumns(fields: any[]) {
    if (!fields.some((f: any) => f.in_list_view)) {
      columns.value = GENERIC_COLUMNS.map((column) => ({ ...column }))
      return
    }
    columns.value = getDefaultColumns(fields, titleField.value)
  }

  function resizeColumn(key: string, width: string) {
    columns.value = applyColumnWidth(columns.value || [], key, width)
  }

  function resetColumnWidth(key: string) {
    columns.value = clearColumnWidth(columns.value || [], key)
  }

  const query = useListQuery({
    listData,
    doctype,
    routePath: route.path,
    filters,
    sort,
    columns,
    metaFields,
    pageSize,
    pageLength,
  })
  const { setPageSize, loadMore } = usePaging(pageSize, pageLength)

  const viewState = useViewState({
    route,
    doctype,
    viewName,
    filters,
    sort,
    columns,
    metaFields,
    seedColumns,
    submit: query.submit,
    router,
  })

  if (routeDoctype(doctype) !== null) loadMeta(doctype)

  const createDoc = useCreateDoc({ createLayout, doctype, route, router })
  const bulkDelete = useBulkDelete({ listData, doctype, submit: query.submit })

  const controlOptions = computed(() => [
    {
      label: 'Customize Quick Filter',
      icon: 'lucide-sliders-horizontal',
      onClick: () => {
        customizing.value = true
      },
    },
  ])

  const breadcrumbs = computed(() =>
    [
      {
        label: doctypeLabel(doctype),
        route: `/${encodeURIComponent(route.params.doctype)}`,
      },
      viewState.viewLabel.value
        ? { label: viewState.viewLabel.value, icon: viewState.viewIcon.value }
        : null,
    ].filter(Boolean),
  )

  const cached = computed(() =>
    listData.data ? undefined : listCache.readRoute(route.path),
  )

  /** An answer with no rows is an empty list, not a list still loading. */
  const listLoading = computed(
    () => !cached.value && !listData.data && !listData.error,
  )

  const listRows = computed(() =>
    cached.value
      ? firstRows(cached.value.response, pageLength.value).data
      : (listData.data?.data ?? []),
  )

  const listColumns = computed(() => {
    if (cached.value) return cached.value.columns
    if (query.wireColumns.value.length) return query.wireColumns.value
    return listCache.readRoute(route.path)?.columns ?? []
  })

  /** The answer on screen, which is the cached one until the request lands. */
  const painted = computed(() =>
    cached.value ? cached.value.response : listData.data,
  )

  const listCounts = computed(() => ({
    rowCount: painted.value?.row_count ?? 0,
    totalCount: painted.value?.total_count ?? 0,
  }))

  const hasCounts = computed(() => Boolean(painted.value))

  return {
    filters,
    sort,
    columns,
    customizing,
    pageSize,
    pageLength,

    listColumns,
    listLoading,
    listRows,
    listCounts,
    hasCounts,
    breadcrumbs,
    controlOptions,
    resizeColumn,
    resetColumnWidth,
    loadMore,
    setPageSize,
    ...viewState,
    ...createDoc,
    ...bulkDelete,
  }
}

function useMeta() {
  const scope = getCurrentScope()
  const metaFields = ref<any[]>([])
  const titleField = ref<string>('')

  function loadMeta(doctype: string) {
    const run = () => {
      const { meta } = useDoctypeMeta(doctype)
      watch(
        meta,
        (loaded: any) => {
          titleField.value = loaded?.title_field || ''
          metaFields.value = loaded?.fields ?? []
        },
        { immediate: true },
      )
    }
    if (scope) scope.run(run)
    else run()
  }

  return { metaFields, titleField, loadMeta }
}

import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useSavedViews } from '@framework/ui/components/SavedViews'
import { findView, useNavigation } from '@framework/ui/components/Navigation'
import { serializeColumns } from '@framework/ui/components/ColumnSettings'
import { serializeOrderBy } from '@framework/ui/components/SortBy'
import { APP_NAME } from '@/data/apps'
import { completeFilters, toFiltersDict } from '@/data/listWire'
import { currentUser } from '@/data/session'
import {
  overridesFromQuery,
  preservedQuery,
  queryFromState,
  stableQuery,
} from '@/data/tweakUrl'

const DEFAULT_SORT = [{ fieldname: 'modified', direction: 'desc' }]
const LANDING_SAVE_DEBOUNCE_MS = 600

export function useViewState(options: {
  route: any
  doctype: string
  viewName: string
  filters: Ref<any[]>
  sort: Ref<any[]>
  columns: Ref<any[]>
  metaFields: Ref<any[]>
  seedColumns: (fields: any[]) => void
  submit: () => void
  router: any
}) {
  const { route, doctype, viewName, filters, sort, columns } = options
  const { metaFields, seedColumns, submit, router } = options

  const navigation = useNavigation(doctype, viewName || null, {
    app: APP_NAME,
  })
  const views = useSavedViews(doctype, {
    app: APP_NAME,
    activeView: navigation.activeView,
    onChange: navigation.reload,
  })

  const started = ref(false)
  const baseline = ref('')

  const dirty = computed(
    () => Boolean(viewName) && started.value && tweakKey() !== baseline.value,
  )

  function tweakKey() {
    return JSON.stringify({
      filters: toFiltersDict(completeFilters(filters.value || [])),
      order_by:
        serializeOrderBy(sort.value || []) || serializeOrderBy(DEFAULT_SORT),
      columns: serializeColumns(columns.value || [], metaFields.value),
    })
  }

  function liveSnapshot() {
    return {
      filters: completeFilters(filters.value || []),
      sort: sort.value || [],
      columns: columns.value || [],
    }
  }

  function applyBase(fields: any[]) {
    const base = viewName
      ? views.activeSnapshot.value
      : views.landingSnapshot.value
    filters.value = base.filters ?? []
    sort.value = base.sort ?? DEFAULT_SORT.map((rule) => ({ ...rule }))
    if (base.columns?.length) columns.value = base.columns
    else seedColumns(fields)
  }

  function start(fields: any[]) {
    applyBase(fields)
    baseline.value = tweakKey()
    applyOverrides(fields)
    started.value = true
    submit()
  }

  function applyOverrides(fields: any[]) {
    const overrides = overridesFromQuery(currentQuery(), doctype, fields)
    if (overrides.filters) filters.value = overrides.filters
    if (overrides.sort) sort.value = overrides.sort
    if (overrides.columns) columns.value = overrides.columns
  }

  if (viewName) {
    watch(
      [metaFields, navigation.activeView],
      ([fields, view]: [any[], any]) => {
        if (started.value || !fields.length || !view) return
        start(fields)
      },
      { immediate: true },
    )
    watch([filters, sort, columns], () => started.value && writeUrl(), {
      deep: true,
    })
  } else {
    views.loadLanding()
    watch(
      [metaFields, views.landingLoaded],
      ([fields, loaded]: [any[], boolean]) => {
        if (started.value || !fields.length || !loaded) return
        start(fields)
      },
      { immediate: true },
    )
    watch(navigation.defaultView, async (next: any, previous: any) => {
      if (!started.value || previous == null || next === previous) return
      await views.loadLanding()
      applyBase(metaFields.value)
      baseline.value = tweakKey()
      submit()
    })

    watch(
      [filters, sort, columns],
      () =>
        started.value && tweakKey() !== baseline.value && scheduleLandingSave(),
      {
        deep: true,
      },
    )
  }

  function writeUrl() {
    const current = currentQuery()
    const preserved = preservedQuery(current, doctype, metaFields.value)
    const query = dirty.value
      ? { ...preserved, ...queryFromState(liveSnapshot()) }
      : preserved
    if (stableQuery(query) === stableQuery(current)) return
    router.replace({ query, hash: liveRoute()?.hash || '' })
  }

  let landingTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleLandingSave() {
    clearTimeout(landingTimer)
    landingTimer = setTimeout(async () => {
      await views.saveLanding(liveSnapshot())
      baseline.value = tweakKey()
    }, LANDING_SAVE_DEBOUNCE_MS)
  }
  onScopeDispose(() => clearTimeout(landingTimer))

  const activeView = computed(() =>
    viewName
      ? navigation.activeView.value
      : findView(navigation.sections.value, navigation.defaultView.value),
  )
  const viewLabel = computed(() => activeView.value?.label || '')
  const viewIcon = computed(() => activeView.value?.icon || '')

  const canEditActiveView = computed(() => {
    const view = navigation.activeView.value
    if (!view) return false
    return view.user
      ? view.user === currentUser.value.email
      : navigation.canManageShared.value
  })

  function resetView() {
    applyBase(metaFields.value)
    submit()
    if (viewName) writeUrl()
  }

  async function saveActiveView() {
    const view = navigation.activeView.value
    if (!view) return
    await views.saveView(view.name, liveSnapshot())
    baseline.value = tweakKey()
    writeUrl()
  }

  const saveAsDialog = ref(false)
  const saveAsLabel = ref('')

  function openSaveAs() {
    saveAsLabel.value = ''
    saveAsDialog.value = true
  }

  async function saveAsNewView() {
    const label = saveAsLabel.value.trim()
    if (!label) return
    const name = await views.saveAsNew(liveSnapshot(), { label })
    saveAsDialog.value = false
    router.push(`/${encodeURIComponent(route.params.doctype)}/view/${name}`)
  }

  const viewSaveOptions = computed(() =>
    [
      canEditActiveView.value
        ? {
            label: 'Save to this view',
            icon: 'lucide-check',
            onClick: saveActiveView,
          }
        : null,
      { label: 'Save as new', icon: 'lucide-copy-plus', onClick: openSaveAs },
    ].filter(Boolean),
  )

  const saveAsActions = computed(() => [
    {
      label: 'Save',
      variant: 'solid',
      disabled: !saveAsLabel.value.trim(),
      onClick: saveAsNewView,
    },
  ])

  function liveRoute() {
    return (router.currentRoute?.value ?? router.currentRoute) as any
  }

  function currentQuery() {
    return (liveRoute()?.query || {}) as Record<string, string>
  }

  return {
    viewLabel,
    viewIcon,
    viewDirty: dirty,
    resetView,
    saveAsDialog,
    saveAsLabel,
    saveAsActions,
    openSaveAs,
    viewSaveOptions,
  }
}

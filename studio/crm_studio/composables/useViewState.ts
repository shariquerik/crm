import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useSavedViews } from '@framework/ui/components/SavedViews'
import { serializeColumns } from '@framework/ui/ColumnSettings'
import { serializeOrderBy } from '@framework/ui/SortBy'
import { completeFilters, toFiltersDict } from '@app/data/listWire'
import { currentUser } from '@app/data/session'
import {
  overridesFromQuery,
  preservedQuery,
  queryFromState,
  stableQuery,
} from '@app/data/tweakUrl'

const DEFAULT_SORT = [{ fieldname: 'modified', direction: 'desc' }]
const LANDING_SAVE_DEBOUNCE_MS = 600

// A view's saved definition is the baseline; tweaking filters, sort, or columns
// diverges from it. On a `/…/view/<id>` route the divergence lives only in the URL
// query and never rewrites the stored view. On the plain list route there is no view
// to modify, so tweaks auto-save into the user's own default (a per-user scratchpad).
export function useViewState(options: {
  ctx: any
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
  const { ctx, doctype, viewName, filters, sort, columns } = options
  const { metaFields, seedColumns, submit, router } = options
  const route = ctx.route

  const views = useSavedViews(doctype, viewName || null)

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
      columns: serializeColumns(columns.value || [], metaFields.value).map(
        ({ width, ...rest }) => rest,
      ),
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
      [metaFields, views.activeView],
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
    watch(
      [filters, sort, columns],
      () => started.value && scheduleLandingSave(),
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
    router.replace({ query })
  }

  let landingTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleLandingSave() {
    clearTimeout(landingTimer)
    landingTimer = setTimeout(
      () => views.saveLanding(liveSnapshot()),
      LANDING_SAVE_DEBOUNCE_MS,
    )
  }
  onScopeDispose(() => clearTimeout(landingTimer))

  // A personal view is editable only by its owner; a shared one only by a manager.
  const canEditActiveView = computed(() => {
    const view = views.activeView.value
    if (!view) return false
    return view.user
      ? view.user === currentUser.value.email
      : views.canManageShared.value
  })

  function resetView() {
    applyBase(metaFields.value)
    submit()
    if (viewName) writeUrl()
  }

  async function saveActiveView() {
    const view = views.activeView.value
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

  const saveAsActions = computed(() => [
    {
      label: 'Save',
      variant: 'solid',
      disabled: !saveAsLabel.value.trim(),
      onClick: saveAsNewView,
    },
  ])

  function currentQuery() {
    const live = (router.currentRoute?.value ?? router.currentRoute) as any
    return (live?.query || {}) as Record<string, string>
  }

  return {
    viewDirty: dirty,
    canEditActiveView,
    resetView,
    saveActiveView,
    saveAsDialog,
    saveAsLabel,
    saveAsActions,
    openSaveAs,
  }
}

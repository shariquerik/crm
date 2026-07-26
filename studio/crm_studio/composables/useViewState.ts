import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useSavedViews } from '@framework/ui/components/SavedViews'
import { findView, useNavigation } from '@framework/ui/components/Navigation'
import { serializeColumns } from '@framework/ui/ColumnSettings'
import { serializeOrderBy } from '@framework/ui/SortBy'
import { APP_NAME } from '@app/data/apps'
import { completeFilters, toFiltersDict } from '@app/data/listWire'
import { currentUser } from '@app/data/session'
import { refreshSidebar, savedViewsToken } from '@app/data/sidebarRefresh'
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

  // The sidebar mutates views through its own useNavigation instance, which leaves
  // this one holding stale sections — a renamed view, or a different one marked
  // default, would otherwise only surface on reload.
  watch(savedViewsToken, () => navigation.reload())

  const dirty = computed(
    () => Boolean(viewName) && started.value && tweakKey() !== baseline.value,
  )

  function tweakKey() {
    return JSON.stringify({
      filters: toFiltersDict(completeFilters(filters.value || [])),
      order_by:
        serializeOrderBy(sort.value || []) || serializeOrderBy(DEFAULT_SORT),
      // A resize is part of the view: its px `width` diverges from the auto `fr`
      // serializeColumns fills in, so it trips the modified indicator and saves.
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
    // Set-as-default rewrote the record this route reads, so the list on screen is
    // no longer what it stores: re-seed from the newly chosen view rather than leave
    // the sidebar marking one view while the rows and breadcrumb show another.
    watch(navigation.defaultView, async (next: any, previous: any) => {
      if (!started.value || previous == null || next === previous) return
      await views.loadLanding()
      applyBase(metaFields.value)
      baseline.value = tweakKey()
      submit()
    })

    // Only a real divergence is a tweak. Seeding the list reassigns all three refs,
    // which the deep watcher cannot tell from an edit — and an auto-save there would
    // turn the default into a standalone scratchpad, dropping the `source_view` that
    // marks which view the user chose as default.
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
    // A location naming only `query` resolves with an empty hash, which would
    // close the settings dialog (#settings/…) as a side effect of a list tweak.
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

  // The plain list route opens the user's default, so it carries that view's own
  // label — an empty one (no default yet) leaves the breadcrumb at the doctype.
  const activeView = computed(() =>
    viewName
      ? navigation.activeView.value
      : findView(navigation.sections.value, navigation.defaultView.value),
  )
  const viewLabel = computed(() => activeView.value?.label || '')
  const viewIcon = computed(() => activeView.value?.icon || '')

  // A personal view is editable only by its owner; a shared one only by a manager.
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
    refreshSidebar()
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
    canEditActiveView,
    resetView,
    saveActiveView,
    saveAsDialog,
    saveAsLabel,
    saveAsActions,
    openSaveAs,
    viewSaveOptions,
  }
}

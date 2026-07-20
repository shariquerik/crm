import { watch, type Ref } from 'vue'
import { useSavedViews } from '@framework/ui/components/SavedViews'

// Restores a framework `Saved View` into the list page's control state.
//
// This runs alongside the legacy `CRM View Settings` path in `useSavedViews`:
// both read `/:doctype/view/:viewName`, and each applies only when the id names a
// record it owns, so neither clobbers the other. That works because the two
// autoincrement sequences do not yet overlap — once `Saved View` reaches an id
// `CRM View Settings` already used, the route is ambiguous and the legacy path has
// to go (ticket 07).
export function useSavedViewRestore(options: {
  doctype: string
  viewName: string
  filters: Ref<any[]>
  sort: Ref<any[]>
  columns: Ref<any[]>
  metaFields: Ref<any[]>
  seedColumns: (fields: any[]) => void
  submit: () => void
}) {
  const { doctype, viewName, filters, sort, columns } = options
  const { metaFields, seedColumns, submit } = options

  const views = useSavedViews(doctype, viewName)

  let applied = false
  watch(
    [metaFields, views.activeView],
    ([fields, view]: [any[], any]) => {
      if (applied || !fields.length || !view) return
      applied = true
      restore(fields)
    },
    { immediate: true },
  )

  function restore(fields: any[]) {
    const snapshot = views.activeSnapshot.value
    if (snapshot.filters) filters.value = snapshot.filters
    if (snapshot.sort) sort.value = snapshot.sort
    if (snapshot.columns?.length) columns.value = snapshot.columns
    else seedColumns(fields)
    submit()
  }

  return { savedView: views.activeView, savedViewGroups: views.groups }
}

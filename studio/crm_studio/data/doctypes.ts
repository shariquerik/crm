import { ref, watch } from 'vue'
import { call } from 'frappe-ui'

const DOCTYPES: Record<string, { label: string; icon: string }> = {
  'CRM Lead': { label: 'Leads', icon: 'lucide-users' },
  'CRM Deal': { label: 'Deals', icon: 'lucide-handshake' },
  Contact: { label: 'Contacts', icon: 'lucide-contact-round' },
  'CRM Organization': { label: 'Organizations', icon: 'lucide-building-2' },
  'CRM Task': { label: 'Tasks', icon: 'lucide-list-checks' },
  'FCRM Note': { label: 'Notes', icon: 'lucide-notebook-pen' },
}

export const doctypeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(DOCTYPES).map(([doctype, { label }]) => [doctype, label]),
)

export function doctypeIcon(doctype: string) {
  return DOCTYPES[doctype]?.icon ?? 'lucide-file'
}

export function guardDoctype(ctx: any, onResolved: () => void, suffix = '') {
  const { routeDoctype, route, router } = ctx
  if (DOCTYPES[route.params.doctype]) {
    onResolved()
    return
  }
  let done = false
  watch(
    () => routeDoctype.data,
    (res: any) => {
      if (done || !res) return
      if (!res.doctype) return
      if (res.doctype !== route.params.doctype) {
        done = true
        router.replace(`/${encodeURIComponent(res.doctype)}${suffix}`)
        return
      }
      done = true
      onResolved()
    },
    { immediate: true },
  )
}

const views = ref<Record<string, any[]>>({})
const viewsLoading = ref(false)
const viewsError = ref('')
let viewsRequested = false

export function fetchViews() {
  if (!viewsRequested) loadViews()
  return { views, loading: viewsLoading, error: viewsError, reload: loadViews }
}

async function loadViews() {
  if (viewsLoading.value) return
  viewsRequested = true
  viewsLoading.value = true
  viewsError.value = ''
  try {
    views.value = groupViews(await call('crm.api.views.get_views'))
  } catch (exception: any) {
    viewsError.value = exception?.message || 'Could not load views'
    // Let the next caller retry rather than stranding every consumer on the failure.
    viewsRequested = false
  } finally {
    viewsLoading.value = false
  }
}

function groupViews(rows: any[]) {
  const grouped: Record<string, any[]> = {}
  for (const row of rows || []) {
    if (!row.dt || row.is_standard || (row.type && row.type !== 'list'))
      continue
    grouped[row.dt] = [...(grouped[row.dt] || []), row]
  }
  return grouped
}

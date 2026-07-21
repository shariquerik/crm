import { watch } from 'vue'

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

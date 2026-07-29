import { watch } from 'vue'

import { isCustomIconName } from '@framework/ui/components/IconPicker'
import { isIconName } from '@/data/icons'
import { railItems } from '@/data/railLayout'

const DOCTYPES: Record<string, { label: string; icon: string }> = {
  'CRM Lead': { label: 'Leads', icon: 'users' },
  'CRM Deal': { label: 'Deals', icon: 'handshake' },
  Contact: { label: 'Contacts', icon: 'contact-round' },
  'CRM Organization': { label: 'Organizations', icon: 'building-2' },
  'CRM Task': { label: 'Tasks', icon: 'list-checks' },
  'FCRM Note': { label: 'Notes', icon: 'notebook-pen' },
}

const doctypeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(DOCTYPES).map(([doctype, { label }]) => [doctype, label]),
)

export function doctypeLabel(doctype: string) {
  const item = railItems.value.find((entry) => entry.dt === doctype)
  return item?.label?.trim() || doctypeLabels[doctype] || doctype
}

export function doctypeIcon(doctype: string, saved?: string | null) {
  const picked = (saved ?? '').replace(/^lucide-/, '').trim()
  if (picked && (isIconName(picked) || isCustomIconName(picked))) return picked
  return DOCTYPES[doctype]?.icon || 'file'
}

export function guardDoctype(
  routeDoctype: any,
  route: any,
  router: any,
  onResolved: () => void,
  suffix = '',
) {
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

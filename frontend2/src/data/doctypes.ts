import { call } from 'frappe-ui'

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

/** A URL segment already known to name a doctype, seeded with the ones this app ships. */
const resolvedDoctypes = new Map<string, string | null>(
  Object.keys(DOCTYPES).map((doctype) => [doctype, doctype]),
)

const pendingDoctypes = new Map<string, Promise<string | null>>()

/**
 * The doctype a URL segment names, or null when it names none. Only the server can
 * turn a slug back into a name, so an unseen segment costs one round trip.
 */
export function resolveRouteDoctype(segment: string): Promise<string | null> {
  const known = resolvedDoctypes.get(segment)
  if (known !== undefined) return Promise.resolve(known)

  const pending = pendingDoctypes.get(segment)
  if (pending) return pending

  const request = call('crm.api.doc.resolve_doctype', { doctype: segment })
    .then((response) => {
      const doctype = (response as { doctype?: string | null })?.doctype ?? null
      resolvedDoctypes.set(segment, doctype)
      if (doctype) resolvedDoctypes.set(doctype, doctype)
      return doctype
    })
    .catch(() => null)
    .finally(() => pendingDoctypes.delete(segment))

  pendingDoctypes.set(segment, request)
  return request
}

/** What the router guard resolved this segment to, for a page that has already mounted. */
export function routeDoctype(segment: string): string | null {
  return resolvedDoctypes.get(segment) ?? null
}

import { call } from 'frappe-ui'

import { isCustomIconName } from '@framework/ui/experimental/IconPicker'
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

/** What a URL segment names: a doctype, or null for nothing. Absent until resolved. */
const resolvedDoctypes = new Map<string, string | null>(
  Object.keys(DOCTYPES).map((doctype) => [doctype, doctype]),
)

const pendingDoctypes = new Map<string, Promise<string | null | undefined>>()

/** Asks the server what a segment names; undefined when it could not be asked. */
export function resolveRouteDoctype(
  segment: string,
): Promise<string | null | undefined> {
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
    .catch(() => undefined)
    .finally(() => pendingDoctypes.delete(segment))

  pendingDoctypes.set(segment, request)
  return request
}

/** What the guard resolved this segment to; undefined when the server never answered. */
export function routeDoctype(segment: string): string | null | undefined {
  return resolvedDoctypes.get(segment)
}

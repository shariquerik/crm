import { watch } from 'vue'

import { isCustomIconName } from '@framework/ui/components/IconPicker'
import { isIconName } from '@app/data/icons'
import { railItems } from '@app/data/railLayout'

// Icons are bare sprite names, not `lucide-*` CSS classes: the classes only exist
// for names hard-coded in source, so a user-picked icon would render as nothing.
// Everything draws them through `<Icon :name>` from frappe-ui/icons.
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

/** What a doctype is called everywhere outside the rail — breadcrumbs included. The
 *  rail item wins, so renaming "CRM Deal" to "Pipeline" there renames it throughout
 *  rather than leaving the two disagreeing; a doctype off the rail keeps this app's
 *  own label for it, and anything else goes by its name. */
export function doctypeLabel(doctype: string) {
  const item = railItems.value.find((entry) => entry.dt === doctype)
  return item?.label?.trim() || doctypeLabels[doctype] || doctype
}

/** The icon a doctype renders with: the one saved on its rail item, else this
 *  app's own default for it, else a generic glyph. */
export function doctypeIcon(doctype: string, saved?: string | null) {
  // A name the sprite no longer carries draws a blank tile, so it falls through —
  // a stored icon outlives the Lucide release that named it.
  const picked = (saved ?? '').replace(/^lucide-/, '').trim()
  if (picked && (isIconName(picked) || isCustomIconName(picked))) return picked
  return DOCTYPES[doctype]?.icon || 'file'
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

// The session user's rail layout, shared by the app shell and the home
// redirect. Module-scope refs per the no-Pinia rule.

import { call, createResource } from 'frappe-ui'
import { computed } from 'vue'

export type RailItem = { dt: string; label: string; icon?: string | null }

export const railLayout = createResource({
  url: 'crm.api.app_sidebar.get_rail_layout',
  auto: true,
  cache: 'railLayout',
})

export const railItems = computed<RailItem[]>(
  () => railLayout.data?.items ?? [],
)

export const addableDoctypes = createResource({
  url: 'crm.api.app_sidebar.addable_doctypes',
  cache: 'railAddableDoctypes',
})

export async function saveRailItems(items: RailItem[]) {
  railLayout.data = await call('crm.api.app_sidebar.update_rail_layout', {
    items: items.map(({ dt, label, icon }) => ({
      dt,
      label: label ?? '',
      icon: icon ?? '',
    })),
  })
}

export function addToRail(doctype: string) {
  return saveRailItems([...railItems.value, { dt: doctype, label: doctype }])
}

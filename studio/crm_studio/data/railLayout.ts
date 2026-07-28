import { createResource } from 'frappe-ui'
import { computed } from 'vue'

import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@app/data/apps'
import { flattenRail, type RailItem } from '@app/data/rail'

export type { RailItem }

const RAIL_SECTION_LABEL = 'Sidebar'

export const railNavigation = useNavigation('', undefined, { app: APP_NAME })

export const railItems = computed<RailItem[]>(() =>
  flattenRail(railNavigation.visibleSections.value),
)

export const placedRailItems = computed<RailItem[]>(() =>
  flattenRail(railNavigation.sections.value),
)

export const addableDoctypes = createResource({
  url: 'crm.navigation.rail.addable_doctypes',
  cache: 'railAddableDoctypes',
})

export const addableDoctypeState = computed(() => ({
  fetched: Boolean(addableDoctypes.fetched),
  names: addableDoctypes.data ?? [],
}))

export async function addToRail(doctype: string) {
  await railNavigation.addItem(await targetSection(), {
    type: 'doctype',
    dt: doctype,
    label: doctype,
  })
}

async function targetSection(): Promise<string> {
  const sections = railNavigation.sections.value
  const last = sections[sections.length - 1]
  if (last) return last.name
  return railNavigation.createSection(
    RAIL_SECTION_LABEL,
    railNavigation.canManageShared.value,
  )
}

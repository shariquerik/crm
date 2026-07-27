// The session user's rail, read from the same navigation model the sidebar reads —
// at the scope that names no doctype, which is the app's own navigation. Module-scope
// per the no-Pinia rule.

import { createResource } from 'frappe-ui'
import { computed } from 'vue'

import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@app/data/apps'
import { flattenRail, type RailItem } from '@app/data/rail'

export type { RailItem }

const RAIL_SECTION_LABEL = 'Sidebar'

// The empty doctype is the scope: app-level navigation, which is what a rail is.
export const railNavigation = useNavigation('', undefined, { app: APP_NAME })

export const railItems = computed<RailItem[]>(() =>
  flattenRail(railNavigation.visibleSections.value),
)

/** The rail including what the user has hidden — which is still placed, and so must
 *  not be offered for adding a second time. */
export const placedRailItems = computed<RailItem[]>(() =>
  flattenRail(railNavigation.sections.value),
)

export const addableDoctypes = createResource({
  url: 'crm.navigation.rail.addable_doctypes',
  cache: 'railAddableDoctypes',
})

/** The addable list and whether it has landed, in the shape the shell reads. */
export const addableDoctypeState = computed(() => ({
  fetched: Boolean(addableDoctypes.fetched),
  names: addableDoctypes.data ?? [],
}))

/** Its All view is seeded server-side as the item lands, so the list it opens has the
 *  sidebar every other list has. */
export async function addToRail(doctype: string) {
  await railNavigation.addItem(await targetSection(), {
    type: 'doctype',
    dt: doctype,
    label: doctype,
  })
}

/** The last rail section, created on demand.
 *
 *  Any of them will do, whoever owns it: adding to a shared section writes the row to
 *  the caller's own overlay of it unless they ask for everyone, which this never does
 *  — putting a doctype on one's own rail is not a decision about anybody else's. */
async function targetSection(): Promise<string> {
  const sections = railNavigation.sections.value
  const last = sections[sections.length - 1]
  if (last) return last.name
  return railNavigation.createSection(
    RAIL_SECTION_LABEL,
    railNavigation.canManageShared.value,
  )
}

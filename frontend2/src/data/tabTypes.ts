import type { Component } from 'vue'
import type { NavigationItem } from '@framework/ui/components/Navigation'
import type { FormLayoutSchema } from '@framework/ui/components/FormLayout'

import ActivityTab from '@/components/record/tabs/ActivityTab.vue'
import DetailsTab from '@/components/record/tabs/DetailsTab.vue'
import UnknownTab from '@/components/record/tabs/UnknownTab.vue'
import type { Docinfo } from '@/data/docinfo'

/** What every tab receives, whatever it reads. `doc` arrives as `v-model:doc`. */
export type TabProps = {
  /** The tab's own stored config. */
  item: NavigationItem
  doc: Record<string, any>
  doctype: string
  docname: string
  docinfo: Docinfo
  layout: FormLayoutSchema
}

type TabKind = { component: Component }

const TABS: Record<string, TabKind> = {
  activity: { component: ActivityTab },
  details: { component: DetailsTab },
}

export function resolveTab(type: string): Component {
  return TABS[type]?.component ?? UnknownTab
}

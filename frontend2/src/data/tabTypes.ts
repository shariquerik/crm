import type { Component } from 'vue'
import type { NavigationItem } from '@framework/ui/components/Navigation'
import type { FormLayoutSchema } from '@framework/ui/components/FormLayout'

import ActivityTab from '@/components/record/tabs/ActivityTab.vue'
import DetailsTab from '@/components/record/tabs/DetailsTab.vue'
import EmailsTab from '@/components/record/tabs/EmailsTab.vue'
import FilesTab from '@/components/record/tabs/FilesTab.vue'
import UnknownTab from '@/components/record/tabs/UnknownTab.vue'
import type { Docinfo } from '@/data/docinfo'
import type { FileRow } from '@/data/files'

/** The queries a feed tab reads, held by the page so an echo can reload one. */
export type Feeds = {
  files: {
    data: FileRow[] | null
    loading: boolean
    fetch: () => void
    reload: () => void
  }
}

/** What every tab receives, whatever it reads. `doc` arrives as `v-model:doc`. */
export type TabProps = {
  /** The tab's own stored config. */
  item: NavigationItem
  doc: Record<string, any>
  doctype: string
  docname: string
  docinfo: Docinfo
  feeds: Feeds
  layout: FormLayoutSchema
}

type TabKind = { component: Component }

const TABS: Record<string, TabKind> = {
  activity: { component: ActivityTab },
  emails: { component: EmailsTab },
  files: { component: FilesTab },
  details: { component: DetailsTab },
}

export function resolveTab(type: string): Component {
  return TABS[type]?.component ?? UnknownTab
}

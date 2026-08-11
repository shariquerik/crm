import type { Component } from 'vue'
import type { NavigationItem } from '@framework/ui/experimental/Navigation'
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

/** What a create action can reach on the composer that offers it. */
export type CreateContext = { attach: () => void }

export type CreateAction = {
  label: string
  icon: string
  run: (context: CreateContext) => void
}

type TabKind = { component: Component; create?: CreateAction }

const TABS: Record<string, TabKind> = {
  activity: { component: ActivityTab },
  emails: { component: EmailsTab },
  files: {
    component: FilesTab,
    create: {
      label: 'Attach a file',
      icon: 'lucide-paperclip',
      run: (context) => context.attach(),
    },
  },
  details: { component: DetailsTab },
}

export function resolveTab(type: string): Component {
  return TABS[type]?.component ?? UnknownTab
}

/** The composer's `+` menu: what the tabs on the strip can create. A scripted
    tab carries its own `create`, whose `run` receives `page` like every callback. */
export function createActions(
  tabs: { type?: string; create?: any }[],
  page?: any,
): CreateAction[] {
  return tabs.flatMap((tab) => {
    if (tab.create)
      return [
        {
          label: tab.create.label,
          icon: tab.create.icon,
          run: () => tab.create.run(page),
        },
      ]
    const create = tab.type ? TABS[tab.type]?.create : undefined
    return create ? [create] : []
  })
}

import { computed, type MaybeRefOrGetter } from 'vue'
import type { NavigationItem } from '@framework/ui/components/Navigation'

/** The record page's tab strip. */
export function useRecordLayout(_doctype: MaybeRefOrGetter<string>) {
  return { tabs: computed<NavigationItem[]>(() => RECORD_TABS) }
}

/** The tab a `?tab=` value names, or the first one. */
export function activeTab(tabs: NavigationItem[], name?: string) {
  return tabs.find((tab) => tab.name === name) ?? tabs[0]
}

/** The panel's overflow surface: where a field with no honest panel row is opened. */
export const DETAILS_TAB = 'details'

export const RECORD_TABS: NavigationItem[] = [
  tabItem('activity', 'Activity', 'lucide-activity'),
  tabItem('emails', 'Emails', 'lucide-mail'),
  tabItem('files', 'Files', 'lucide-paperclip'),
  tabItem(DETAILS_TAB, 'Details', 'lucide-table-properties'),
]

function tabItem(type: string, label: string, icon: string): NavigationItem {
  return {
    name: type,
    type,
    label,
    icon,
    dt: '',
    url: '',
    new_tab: 0,
    hidden: 0,
    own: 0,
    view: null,
  }
}

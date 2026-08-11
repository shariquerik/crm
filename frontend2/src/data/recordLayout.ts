import { computed, type MaybeRefOrGetter } from 'vue'
import type { NavigationItem } from '@framework/ui/experimental/Navigation'

/** The record page's tab strip. */
export function useRecordLayout(_doctype: MaybeRefOrGetter<string>) {
  return { tabs: computed<NavigationItem[]>(() => RECORD_TABS) }
}

/** The tab a `?tab=` value names, or the first one. */
export function activeTab<T extends { name: string }>(
  tabs: T[],
  name?: string,
) {
  return tabs.find((tab) => tab.name === name) ?? tabs[0]
}

/** The panel's overflow surface: where a field with no honest panel row is opened. */
export const DETAILS_TAB = 'details'

export const ACTIVITY_TAB = 'activity'

/** Where the panel's Email action sends the reader, so the composer it opens is in view. */
export const EMAILS_TAB = 'emails'

/** Tabs that carry the email composer themselves, so the Email action stays where it is. */
const COMPOSER_TABS = [ACTIVITY_TAB, EMAILS_TAB]

// Resolved against the tabs actually on the strip: a scripted tab carries no
// composer, so the action must switch away from it.
export function hasComposer(tabs: { name: string }[], name?: string) {
  const current = activeTab(tabs, name)
  return current ? COMPOSER_TABS.includes(current.name) : false
}

export const RECORD_TABS: NavigationItem[] = [
  tabItem(ACTIVITY_TAB, 'Activity', 'lucide-activity'),
  tabItem(EMAILS_TAB, 'Emails', 'lucide-mail'),
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

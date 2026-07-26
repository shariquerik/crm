// Bump signals between the page and the sidebar, which run separate useNavigation
// instances and so cannot see each other's writes. Module-scope refs, per the
// no-Pinia rule.

import { ref } from 'vue'

// Page → sidebar: the page created a view (Save as new) and the sidebar must show it.
export const sidebarRefreshToken = ref(0)

export function refreshSidebar() {
  sidebarRefreshToken.value += 1
}

// Sidebar → page: a menu action changed the views, so the page's own copy — the
// breadcrumb label and which view is marked default — is stale.
export const savedViewsToken = ref(0)

export function savedViewsChanged() {
  savedViewsToken.value += 1
}

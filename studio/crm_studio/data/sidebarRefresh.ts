// A bump signal the page raises after it creates a view (Save as new), so the
// sidebar — a separate useSavedViews instance — refetches and shows it. A
// module-scope ref, per the no-Pinia rule.

import { ref } from 'vue'

export const sidebarRefreshToken = ref(0)

export function refreshSidebar() {
  sidebarRefreshToken.value += 1
}

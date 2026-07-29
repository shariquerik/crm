import { ref } from 'vue'

export const sidebarRefreshToken = ref(0)

export function refreshSidebar() {
  sidebarRefreshToken.value += 1
}

export const savedViewsToken = ref(0)

export function savedViewsChanged() {
  savedViewsToken.value += 1
}

export const countsRefreshToken = ref(0)

export function refreshViewCounts() {
  countsRefreshToken.value += 1
}

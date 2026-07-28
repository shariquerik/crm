import { ref } from 'vue'

export const countsRefreshToken = ref(0)

export function refreshViewCounts() {
  countsRefreshToken.value += 1
}

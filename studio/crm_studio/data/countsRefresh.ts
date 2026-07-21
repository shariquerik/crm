// A bump signal the list page raises after a record create or delete so the
// sidebar recounts its views. A module-scope ref, per the no-Pinia rule.

import { ref } from 'vue'

export const countsRefreshToken = ref(0)

export function refreshViewCounts() {
  countsRefreshToken.value += 1
}

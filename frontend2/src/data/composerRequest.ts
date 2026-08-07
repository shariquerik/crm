/** The panel's composer actions, claimed by whichever composer is mounted when they land. */
import { ref } from 'vue'

import type { ComposerMode } from '@/data/composer'

const pendingComposer = ref<ComposerMode | null>(null)

export function requestComposer(mode: ComposerMode) {
  pendingComposer.value = mode
}

/** The requested mode once, for the first composer to ask after the action fired. */
export function claimComposer() {
  const mode = pendingComposer.value
  pendingComposer.value = null
  return mode
}

export { pendingComposer }

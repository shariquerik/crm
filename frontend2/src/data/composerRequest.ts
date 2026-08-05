/** The panel's Email action, claimed by whichever composer is mounted when it lands. */
import { ref } from 'vue'

const pendingReply = ref(false)

export function requestReply() {
  pendingReply.value = true
}

/** True once, for the first composer to ask after the action fired. */
export function claimReply() {
  if (!pendingReply.value) return false
  pendingReply.value = false
  return true
}

export { pendingReply }

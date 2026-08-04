// PROTOTYPE — throwaway. Module-scope so the panel and the Details tab share one dirty
// state, the way they will share one doc. Nothing here edits a value yet; touching an
// editable field stands in for that.
import { ref } from 'vue'

import type { PanelField } from './genericMock'

export const isDirty = ref(false)

export function editField(field: PanelField) {
  if (!field.readOnly) isDirty.value = true
}

export function save() {
  isDirty.value = false
}

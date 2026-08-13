import { computed } from 'vue'
import { useHashDialog } from '@framework/ui/experimental'

const DEFAULT_TAB = 'profile'

export function useSettingsDialog() {
  const dialog = useHashDialog('settings')

  const open = computed({
    get: () => dialog.open.value,
    set: (value) => {
      if (value === dialog.open.value) return
      if (value) openSettings()
      else dialog.close()
    },
  })

  const tab = computed({
    get: () => dialog.segments.value[0] || DEFAULT_TAB,
    set: (value) => dialog.write(String(value ?? DEFAULT_TAB)),
  })

  function openSettings(...path: string[]) {
    dialog.write(...(path.length ? path : [DEFAULT_TAB]))
  }

  return { open, tab, openSettings }
}

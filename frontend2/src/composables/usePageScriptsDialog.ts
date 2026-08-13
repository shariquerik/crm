import { computed } from 'vue'
import { useHashDialog } from '@framework/ui/experimental'

export function usePageScriptsDialog() {
  const dialog = useHashDialog('page-scripts')

  const open = computed({
    get: () => dialog.open.value,
    set: (value) => {
      if (!value) dialog.close()
    },
  })

  const doctype = computed(() => dialog.segments.value[0] ?? '')

  // The editor corrects a name it cannot find, so this is written back to as
  // often as it is read from.
  const script = computed({
    get: () => dialog.segments.value[1],
    set: (value) => {
      if (doctype.value) dialog.write(doctype.value, ...(value ? [value] : []))
    },
  })

  function openPageScripts(forDoctype: string) {
    dialog.write(forDoctype)
  }

  return { open, doctype, script, openPageScripts }
}

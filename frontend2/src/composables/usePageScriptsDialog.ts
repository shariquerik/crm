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

  // The editor's own doctype crumb switches this (ticket 37), and switching it
  // is exactly what `#page-scripts/<doctype>` already addresses — so a pick
  // rewrites the hash and the script segment goes with the doctype it belonged
  // to, rather than pointing at a script the new doctype has never heard of.
  const doctype = computed({
    get: () => dialog.segments.value[0] ?? '',
    set: (value) => {
      if (value) dialog.write(value)
    },
  })

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

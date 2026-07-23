import { computed, h, ref } from 'vue'

import KeyboardShortcut from '@app/components/KeyboardShortcut.vue'
import { useSettingsDialog } from '@app/composables/useSettingsDialog'
import { installedApps } from '@app/data/apps'

// No general app settings yet, so Settings lands on the first workspace tab.
const SETTINGS_TAB = 'users'
const SETTINGS_KEYS = ['cmd', 'shift', ',']

export function useAppMenu() {
  const { openSettings } = useSettingsDialog()
  const showAbout = ref(false)

  const appsSubmenu = computed(() =>
    installedApps.value.map((app) => ({
      label: app.title,
      slots: {
        prefix: () =>
          h('img', { src: app.logo, alt: '', class: 'size-4 rounded-sm' }),
      },
      onClick: () => window.location.assign(app.route),
    })),
  )

  const appMenuOptions = computed(() => [
    {
      icon: 'lucide-layout-grid',
      label: 'Apps',
      submenu: appsSubmenu.value,
    },
    {
      icon: 'lucide-settings',
      label: 'Settings',
      slots: { suffix: () => h(KeyboardShortcut, { keys: SETTINGS_KEYS }) },
      onClick: () => openSettings(SETTINGS_TAB),
    },
    {
      icon: 'lucide-info',
      label: 'About',
      onClick: () => (showAbout.value = true),
    },
  ])

  // Cmd/Ctrl+Shift+Comma opens Settings. Matched on `code`, not `key`, because
  // Shift rewrites the printed character (comma becomes `<`).
  function onKeydown(event: KeyboardEvent) {
    if (
      event.code === 'Comma' &&
      event.shiftKey &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault()
      openSettings(SETTINGS_TAB)
    }
  }

  return { appMenuOptions, showAbout, onKeydown }
}

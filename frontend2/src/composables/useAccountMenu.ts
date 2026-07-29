import { useTheme } from 'frappe-ui'
import { computed } from 'vue'

import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { logout } from '@/data/session'

export function useAccountMenu() {
  const { currentTheme, setTheme } = useTheme()
  const { openSettings } = useSettingsDialog()

  const userMenuOptions = computed(() => [
    {
      icon: 'lucide-circle-user',
      label: 'My profile',
      onClick: () => openSettings('profile'),
    },
    {
      icon: 'lucide-moon',
      label: 'Toggle theme',
      submenu: [
        {
          icon: 'lucide-sun',
          label: 'Light Mode',
          selected: currentTheme.value === 'light',
          onClick: () => setTheme('light'),
        },
        {
          icon: 'lucide-moon',
          label: 'Dark Mode',
          selected: currentTheme.value === 'dark',
          onClick: () => setTheme('dark'),
        },
        {
          icon: 'lucide-monitor',
          label: 'System Default',
          selected: currentTheme.value === 'system',
          onClick: () => setTheme('system'),
        },
      ],
    },
    {
      icon: 'lucide-log-out',
      label: 'Log out',
      onClick: logout,
    },
  ])

  return { userMenuOptions }
}

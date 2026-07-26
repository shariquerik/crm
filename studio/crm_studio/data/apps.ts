// The Frappe apps installed on this site, for the app-switcher submenu. Desk is
// prepended (it has no entry in `get_apps`) and the CRM itself is dropped — you
// are already in it. Module-scope resource per the no-Pinia rule.

import { createResource } from 'frappe-ui'
import { computed } from 'vue'

// This app's frappe app name, and the navigation scope every sidebar read is
// filtered by — what keeps another app's sections out of ours.
export const APP_NAME = 'crm'

export type InstalledApp = {
  name: string
  logo: string
  title: string
  route: string
}

const DESK: InstalledApp = {
  name: 'frappe',
  logo: '/assets/frappe/images/framework.png',
  title: 'Desk',
  route: '/app',
}

export const installedAppsResource = createResource({
  url: 'frappe.apps.get_apps',
  cache: 'apps',
  auto: true,
  transform: (data: InstalledApp[]) => [
    DESK,
    ...data.filter((app) => app.name !== APP_NAME),
  ],
})

export const installedApps = computed<InstalledApp[]>(
  () => installedAppsResource.data ?? [DESK],
)

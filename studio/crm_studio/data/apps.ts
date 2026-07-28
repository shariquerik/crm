import { createResource } from 'frappe-ui'
import { computed } from 'vue'

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

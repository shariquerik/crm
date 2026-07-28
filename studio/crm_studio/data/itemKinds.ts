import type { NavigationItemKind } from '@framework/ui/components/Navigation'

const STUDIO_APP = 'crm-studio'

export const ITEM_KINDS: NavigationItemKind[] = [
  {
    type: 'page',
    label: 'Page',
    icon: 'layout',
    field: 'page',
    doctype: 'Studio Page',
    filters: { studio_app: STUDIO_APP, published: 1 },
    placeholder: 'Pick a page',
  },
]

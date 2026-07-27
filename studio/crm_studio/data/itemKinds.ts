// The `page` navigation item type CRM adds to the three the framework ships — the
// client half of `crm/navigation/page_items.py`, which is what resolves where such
// an item leads. The filter matches the server's: a page's route is unique only
// within its own Studio app, and an unpublished one has no address to send anyone to.

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

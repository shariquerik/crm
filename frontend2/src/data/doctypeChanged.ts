import { navigationScope } from '@framework/ui/components/Navigation'

import { APP_NAME } from '@/data/apps'
import { docCache, listCache } from '@/data/cache/queryCache'

/** What a write to a doctype leaves stale: the lists and records that held it, and the view counts. */
export function doctypeChanged(doctype: string) {
  listCache.invalidate(doctype)
  docCache.invalidate(doctype)
  navigationScope(doctype, { app: APP_NAME })
    .loadCounts(true)
    .catch(() => {})
}

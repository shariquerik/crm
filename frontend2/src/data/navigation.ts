import { useNavigation } from '@framework/ui/components/Navigation'

import { APP_NAME } from '@/data/apps'

/** Every consumer of a doctype shares one navigation state, so the sidebar sees this. */
export function refreshViewCounts(doctype: string) {
  useNavigation(doctype, null, { app: APP_NAME })
    .loadCounts(true)
    .catch(() => {})
}

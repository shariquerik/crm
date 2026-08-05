import { type Ref } from 'vue'
import { call } from 'frappe-ui'

import {
  useRemoteSearch,
  type SearchOption,
} from '@/composables/useRemoteSearch'

/** Tags to pick from, matched on the server as the reader types. */
export function useTagSearch(
  doctype: () => string,
  pinned: Ref<SearchOption[]>,
) {
  return useRemoteSearch((query) => searchTags(doctype(), query), pinned)
}

// The server pages its answer, so it matches the query; the list is not filtered here.
async function searchTags(doctype: string, query: string) {
  const found: string[] = await call('frappe.desk.doctype.tag.tag.get_tags', {
    doctype,
    txt: query.trim(),
  })
  return (found ?? []).map((tag) => ({ label: tag, value: tag }))
}

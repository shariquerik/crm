/** Everyone the composer can @-mention, fetched once for the session. */

import { ref } from 'vue'
import { call } from 'frappe-ui'
import type { MentionOption } from '@framework/ui/components/Composer'

const MENTION_LIMIT = 200

export const mentionOptions = ref<MentionOption[]>([])

let pending: Promise<void> | null = null

export function loadMentionOptions() {
  pending ??= fetchUsers()
  return pending
}

async function fetchUsers() {
  try {
    const rows = await call('frappe.client.get_list', {
      doctype: 'User',
      fields: ['name', 'full_name'],
      filters: { enabled: 1, user_type: 'System User' },
      order_by: 'full_name asc',
      limit_page_length: MENTION_LIMIT,
    })
    mentionOptions.value = rows.map(toMentionOption)
  } catch {
    pending = null
  }
}

// `value` is the user id: it lands in the mention's `data-id`, which is what the
// server reads back to notify them.
function toMentionOption(row: any): MentionOption {
  return { label: row.full_name || row.name, value: row.name }
}

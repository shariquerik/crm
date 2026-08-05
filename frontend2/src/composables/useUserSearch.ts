import { type Ref } from 'vue'
import { call } from 'frappe-ui'

import {
  useRemoteSearch,
  type SearchOption,
} from '@/composables/useRemoteSearch'

export type UserOption = SearchOption & { image: string }

const PAGE_LENGTH = 10

/** Users to pick from, matched on the server as the reader types. */
export function useUserSearch(pinned: Ref<UserOption[]>) {
  return useRemoteSearch(searchUsers, pinned)
}

async function searchUsers(query: string): Promise<UserOption[]> {
  const rows: any[] = await call('frappe.client.get_list', searchParams(query))
  return rows.map(toUserOption)
}

function searchParams(query: string) {
  return {
    doctype: 'User',
    fields: ['name', 'full_name', 'user_image'],
    filters: { enabled: 1, user_type: 'System User' },
    or_filters: query
      ? [
          ['full_name', 'like', `%${query}%`],
          ['name', 'like', `%${query}%`],
        ]
      : undefined,
    order_by: 'full_name asc',
    limit_page_length: PAGE_LENGTH,
  }
}

function toUserOption(row: any): UserOption {
  return {
    label: row.full_name || row.name,
    value: row.name,
    image: row.user_image || '',
  }
}

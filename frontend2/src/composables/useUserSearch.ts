import { computed, ref, type Ref } from 'vue'
import { call } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'

import { errorMessage } from '@/data/errors'

export type UserOption = {
  label: string
  value: string
  image: string
}

const PAGE_LENGTH = 10

/** Users to pick from, matched on the server as the reader types. */
export function useUserSearch(pinned: Ref<UserOption[]>) {
  const results = ref<UserOption[]>([])
  const loading = ref(false)
  const error = ref('')

  let latestRequest = 0

  async function search(query = '') {
    const request = ++latestRequest
    loading.value = true
    try {
      const rows = await call('frappe.client.get_list', searchParams(query))
      // An earlier but slower answer must not overwrite the latest one.
      if (request !== latestRequest) return
      results.value = rows.map(toUserOption)
      error.value = ''
    } catch (caught: any) {
      if (request !== latestRequest) return
      error.value = errorMessage(caught)
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  const searchSoon = useDebounceFn(search, 250)

  /** Pinned first, so a picked user stays resolvable once the query narrows. */
  const options = computed(() => {
    const shown = new Map(pinned.value.map((user) => [user.value, user]))
    for (const user of results.value)
      if (!shown.has(user.value)) shown.set(user.value, user)
    return [...shown.values()]
  })

  return { options, loading, error, search, searchSoon }
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

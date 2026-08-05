import { computed, ref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { errorMessage } from '@/data/errors'

export type SearchOption = { label: string; value: string }

/** Options matched on the server as the reader types, with the pinned ones kept. */
export function useRemoteSearch<Option extends SearchOption>(
  fetchOptions: (query: string) => Promise<Option[]>,
  pinned: Ref<Option[]>,
) {
  const results = ref<Option[]>([]) as Ref<Option[]>
  const loading = ref(false)
  const error = ref('')
  const searched = ref(false)

  let latestRequest = 0

  async function search(query = '') {
    const request = ++latestRequest
    loading.value = true
    try {
      const found = await fetchOptions(query)
      // An earlier but slower answer must not overwrite the latest one.
      if (request !== latestRequest) return
      results.value = found
      error.value = ''
      searched.value = true
    } catch (caught: any) {
      if (request !== latestRequest) return
      error.value = errorMessage(caught)
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  const searchSoon = useDebounceFn(search, 250)

  // The server's order wins and pinned options only fill gaps, so picking one already
  // on the list never reorders it under the pointer.
  const options = computed(() => {
    const shown = new Map(results.value.map((option) => [option.value, option]))
    for (const option of pinned.value)
      if (!shown.has(option.value)) shown.set(option.value, option)
    return [...shown.values()]
  })

  return { options, loading, error, searched, search, searchSoon }
}

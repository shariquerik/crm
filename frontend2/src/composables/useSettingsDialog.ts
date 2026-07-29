import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const HASH_ROOT = 'settings'
const DEFAULT_TAB = 'profile'

export function useSettingsDialog() {
  const route = useRoute()
  const router = useRouter()

  const segments = computed(() => {
    const parts = route.hash.replace(/^#/, '').split('/')
    return parts[0] === HASH_ROOT ? parts.slice(1) : null
  })

  const open = computed({
    get: () => segments.value !== null,
    set: (value) => {
      if (value === open.value) return
      if (value) openSettings()
      else write([])
    },
  })

  const tab = computed({
    get: () => segments.value?.[0] || DEFAULT_TAB,
    set: (value) => write([String(value ?? DEFAULT_TAB)]),
  })

  function openSettings(...path: string[]) {
    write(path.length ? path : [DEFAULT_TAB])
  }

  function write(path: string[]) {
    const hash = path.length ? `#${[HASH_ROOT, ...path].join('/')}` : ''
    router.push({ query: route.query, hash })
  }

  return { open, tab, openSettings }
}

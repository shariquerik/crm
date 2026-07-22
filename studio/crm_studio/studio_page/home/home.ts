import { watch } from 'vue'

import { railItems } from '@app/data/railLayout'

export default function setup(ctx: any) {
  const { router } = ctx

  watch(
    railItems,
    (items) => {
      const first = items[0]
      if (!first?.dt) return
      router.replace(`/${encodeURIComponent(first.dt)}`)
    },
    { immediate: true },
  )

  return {}
}

import { watch } from 'vue'

import { railHomeRoute } from '@app/data/rail'
import { railItems } from '@app/data/railLayout'

export default function setup(ctx: any) {
  const { router } = ctx

  watch(
    railItems,
    (items) => {
      const route = railHomeRoute(items)
      if (route) router.replace(route)
    },
    { immediate: true },
  )

  return {}
}

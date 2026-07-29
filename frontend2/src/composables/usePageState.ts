import { nextTick, ref, watch, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'

import { pageState } from '@/data/cache/pageState'

/** A ref that outlives its page: the same history entry hands it back on a return. */
export function useRestoredRef<Value>(
  name: string,
  initial: Value,
): Ref<Value> {
  const bag = pageState()
  const state = ref((bag[name] as Value) ?? initial) as Ref<Value>
  watch(state, (value) => {
    bag[name] = value
  })
  return state
}

/**
 * Puts a scroller back where the entry left it. Waits for `ready`, because an offset
 * set before the content that gives the scroller its height is clamped back to zero.
 */
export function useScrollRestore(
  element: Ref<HTMLElement | null | undefined>,
  ready: () => boolean,
) {
  const offset = useRestoredRef('scrollTop', 0)
  const { y } = useScroll(element, { throttle: 100 })

  let restored = false
  watch(y, (value) => {
    if (restored) offset.value = value
  })

  watch(
    [element, ready],
    ([target, isReady]) => {
      if (restored || !target || !isReady) return
      restored = true
      const wanted = offset.value
      if (!wanted) return
      nextTick(() => requestAnimationFrame(() => (target.scrollTop = wanted)))
    },
    { immediate: true },
  )
}

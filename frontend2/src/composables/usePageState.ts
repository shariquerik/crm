import { nextTick, ref, watch, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'

import { pageState } from '@/data/cache/pageState'

/** A ref that outlives its page: the same history entry hands it back on a return. */
export function useRestoredRef<Value>(
  name: string,
  initial: Value,
): Ref<Value> {
  const state = ref((pageState()[name] as Value) ?? initial) as Ref<Value>
  // Read and written against whichever entry is current: a saved-view tweak rewrites
  // the query, which is a new entry under the same live page.
  watch(state, (value) => {
    pageState()[name] = value
  })
  return state
}

/** Puts a scroller back where the entry left it, once the rows that give it height are in. */
export function useScrollRestore(
  element: Ref<HTMLElement | null | undefined>,
  ready: () => boolean,
) {
  const offset = useRestoredRef('scrollTop', 0)
  const { y } = useScroll(element, { throttle: 100 })

  let restored = false
  watch(y, (value) => {
    if (restored && ready()) offset.value = value
  })

  watch(
    [element, ready],
    ([target, isReady]) => {
      if (restored || !target || !isReady) return
      restored = true
      const wanted = offset.value
      if (!wanted) return
      nextTick(() => requestAnimationFrame(() => land(target, wanted)))
    },
    { immediate: true },
  )
}

/** A scroller clamps an offset its content cannot reach, so try again once it has grown. */
function land(target: HTMLElement, wanted: number, attempt = 0) {
  target.scrollTop = wanted
  if (target.scrollTop >= wanted || attempt >= 5) return
  requestAnimationFrame(() => land(target, wanted, attempt + 1))
}

import { nextTick, ref, watch, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'

import { pageState } from '@/data/cache/pageState'

const GROW_TIMEOUT_MS = 3000

/** A ref that outlives its page: the same history entry hands it back on a return. */
export function useRestoredRef<Value>(
  name: string,
  initial: Value,
): Ref<Value> {
  const path = window.location.pathname
  const state = ref((pageState()[name] as Value) ?? initial) as Ref<Value>
  // Follows a saved-view tweak, which rewrites the query into a new entry under the
  // same live page, but drops a late write once another page owns the entry.
  watch(state, (value) => {
    if (window.location.pathname === path) pageState()[name] = value
  })
  return state
}

/** Where a scroller opens before the entry has an offset of its own. */
type Anchor = number | 'bottom'

/** Puts a scroller back where the entry left it, once the rows that give it height are in. */
export function useScrollRestore(
  element: Ref<HTMLElement | null | undefined>,
  ready: () => boolean,
  name = 'scrollTop',
  fallback: Anchor = 0,
) {
  const offset = useRestoredRef<number | null>(name, null)
  const { y } = useScroll(element, { throttle: 100 })
  const landed = ref(false)

  let restored = false
  // A restore is not a reader moving: the re-render that resets the scroller would
  // otherwise be recorded as their new place.
  let holding = false
  watch(y, (value) => {
    if (restored && !holding && ready()) offset.value = value
  })

  watch(
    [element, ready],
    ([target, isReady]) => {
      if (restored || !target || !isReady) return
      restored = true
      const wanted = offset.value ?? fallback
      if (!wanted) return (landed.value = true)
      holding = true
      nextTick(() =>
        requestAnimationFrame(() =>
          land(target, wanted, {
            placed: () => (landed.value = true),
            release: () => (holding = false),
          }),
        ),
      )
    },
    { immediate: true },
  )

  return { landed }
}

/**
 * Holds the offset while the rows arrive: the list re-renders as live data replaces the
 * repaint, which resets the scroller. Lets go as soon as the reader scrolls themselves.
 */
function land(
  target: HTMLElement,
  wanted: Anchor,
  { placed, release }: { placed: () => void; release: () => void },
) {
  const deadline = Date.now() + GROW_TIMEOUT_MS
  let expected = -1
  let stopped = false

  const onScroll = () => {
    // A reset to the top is the list re-rendering, not the reader moving.
    if (target.scrollTop === expected || target.scrollTop === 0) return
    stop()
  }

  const stop = () => {
    stopped = true
    target.removeEventListener('scroll', onScroll)
    placed()
    release()
  }

  const hold = () => {
    if (stopped) return
    const top = destination(target, wanted)
    if (top !== null) {
      if (target.scrollTop !== top) {
        target.scrollTop = top
        expected = target.scrollTop
      }
      // Sitting where it belongs counts as landed: a feed shorter than the scroller
      // is already there, and would otherwise stay hidden until the deadline.
      placed()
    }
    if (Date.now() > deadline) return stop()
    requestAnimationFrame(hold)
  }

  target.addEventListener('scroll', onScroll, { passive: true })
  hold()
}

/** Null while the rows are still too few to reach a fixed offset. */
function destination(target: HTMLElement, wanted: Anchor) {
  const bottom = target.scrollHeight - target.clientHeight
  if (wanted === 'bottom') return bottom
  return bottom >= wanted ? wanted : null
}

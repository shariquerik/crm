import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { clearPageState } from '@/data/cache/pageState'
import { useRestoredRef } from '@/composables/usePageState'

function standOn(key: string) {
  window.history.replaceState({ key }, '', '/CRM Lead')
}

/** Mounting is what a page does; the ref has to survive that page going away. */
function onPage<Value>(run: () => Value): Value {
  const scope = effectScope()
  const result = scope.run(run) as Value
  return result
}

describe('useRestoredRef', () => {
  beforeEach(() => {
    clearPageState()
    standOn('entry-1')
  })

  it('starts at the value it was given', () => {
    expect(onPage(() => useRestoredRef('pageLength', 20)).value).toBe(20)
  })

  it('hands the entry back what it last held', async () => {
    const first = onPage(() => useRestoredRef('pageLength', 20))
    first.value = 60
    await nextTick()

    expect(onPage(() => useRestoredRef('pageLength', 20)).value).toBe(60)
  })

  it('starts fresh on a history entry that has not held it', async () => {
    const first = onPage(() => useRestoredRef('pageLength', 20))
    first.value = 60
    await nextTick()
    standOn('entry-2')

    expect(onPage(() => useRestoredRef('pageLength', 20)).value).toBe(20)
  })

  it('keeps two names apart within one entry', async () => {
    const pageLength = onPage(() => useRestoredRef('pageLength', 20))
    const scrollTop = onPage(() => useRestoredRef('scrollTop', 0))
    pageLength.value = 60
    scrollTop.value = 800
    await nextTick()

    expect(onPage(() => useRestoredRef('scrollTop', 0)).value).toBe(800)
    expect(onPage(() => useRestoredRef('pageLength', 20)).value).toBe(60)
  })
})

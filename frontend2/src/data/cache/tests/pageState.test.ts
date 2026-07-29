import { beforeEach, describe, expect, it } from 'vitest'

import { clearPageState, pageState } from '@/data/cache/pageState'

function standOn(key: string | null) {
  window.history.replaceState(key === null ? null : { key }, '', '/CRM Lead')
}

describe('pageState', () => {
  beforeEach(() => {
    clearPageState()
    standOn(null)
  })

  it('hands the same bag back while the entry is the one being viewed', () => {
    standOn('entry-1')
    pageState().pageLength = 60

    expect(pageState().pageLength).toBe(60)
  })

  it('gives a different history entry its own bag, even on the same path', () => {
    standOn('entry-1')
    pageState().pageLength = 60
    standOn('entry-2')

    expect(pageState().pageLength).toBeUndefined()
  })

  it('still has the first entry when it is returned to', () => {
    standOn('entry-1')
    pageState().pageLength = 60
    standOn('entry-2')
    pageState().pageLength = 20
    standOn('entry-1')

    expect(pageState().pageLength).toBe(60)
  })

  it('falls back to one bag for a load that has no entry key yet', () => {
    pageState().pageLength = 40

    expect(pageState().pageLength).toBe(40)
  })
})

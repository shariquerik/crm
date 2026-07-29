import { beforeEach, describe, expect, it } from 'vitest'

import { clearPageState, pageState } from '@/data/cache/pageState'

function standOn(position: number | null, path = '/CRM Lead') {
  window.history.replaceState(position === null ? null : { position }, '', path)
}

describe('pageState', () => {
  beforeEach(() => {
    clearPageState()
    standOn(null)
  })

  it('hands the same bag back while the entry is the one being viewed', () => {
    standOn(1)
    pageState().pageLength = 60

    expect(pageState().pageLength).toBe(60)
  })

  it('gives a different history entry its own bag, even on the same path', () => {
    standOn(1)
    pageState().pageLength = 60
    standOn(2)

    expect(pageState().pageLength).toBeUndefined()
  })

  it('still has the first entry when it is returned to', () => {
    standOn(1)
    pageState().pageLength = 60
    standOn(2)
    pageState().pageLength = 20
    standOn(1)

    expect(pageState().pageLength).toBe(60)
  })

  it('gives a slot back to the page that took it over from a dropped entry', () => {
    standOn(1)
    pageState().pageLength = 60
    standOn(1, '/CRM Deal')

    expect(pageState().pageLength).toBeUndefined()
  })

  it('keeps a bag across a replace, which stays on the same entry', () => {
    standOn(1)
    pageState().pageLength = 60
    window.history.replaceState(
      { position: 1, replaced: true },
      '',
      '/CRM Lead?view=2',
    )

    expect(pageState().pageLength).toBe(60)
  })

  it('falls back to one bag for a load that has no entry number yet', () => {
    pageState().pageLength = 40

    expect(pageState().pageLength).toBe(40)
  })
})

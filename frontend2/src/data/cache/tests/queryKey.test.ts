import { describe, expect, it } from 'vitest'

import { cacheKey, fetchKey } from '@/data/cache/queryKey'

function params(overrides: Record<string, unknown> = {}) {
  return {
    doctype: 'CRM Lead',
    filters: { status: ['=', 'Open'] },
    order_by: 'modified desc',
    page_length: 20,
    page_length_count: 20,
    ...overrides,
  }
}

describe('fetchKey', () => {
  it('reads the same for two params objects written in a different order', () => {
    const one = fetchKey({ doctype: 'CRM Lead', order_by: 'modified desc' })
    const other = fetchKey({ order_by: 'modified desc', doctype: 'CRM Lead' })

    expect(one).toBe(other)
  })

  it('reads the same however the user ordered their filters', () => {
    const one = fetchKey(
      params({ filters: { status: ['=', 'Open'], lead_name: ['like', 'a'] } }),
    )
    const other = fetchKey(
      params({ filters: { lead_name: ['like', 'a'], status: ['=', 'Open'] } }),
    )

    expect(one).toBe(other)
  })

  it('ignores a column width, which does not change what is fetched', () => {
    const narrow = fetchKey(
      params({ columns: [{ key: 'name', width: '8rem' }] }),
    )
    const wide = fetchKey(
      params({ columns: [{ key: 'name', width: '20rem' }] }),
    )

    expect(narrow).toBe(wide)
  })

  it('separates two different filters', () => {
    expect(fetchKey(params())).not.toBe(
      fetchKey(params({ filters: { status: ['=', 'Closed'] } })),
    )
  })

  it('separates a request for more rows, so paging in still fetches', () => {
    expect(fetchKey(params())).not.toBe(fetchKey(params({ page_length: 40 })))
  })
})

describe('cacheKey', () => {
  it('keys paging the same, since more rows extend one answer', () => {
    expect(cacheKey(params())).toBe(cacheKey(params({ page_length: 40 })))
  })

  it('still separates a different page size, which counts differently', () => {
    expect(cacheKey(params())).not.toBe(
      cacheKey(params({ page_length_count: 100 })),
    )
  })

  it('still separates two different queries', () => {
    expect(cacheKey(params())).not.toBe(
      cacheKey(params({ order_by: 'creation asc' })),
    )
  })
})

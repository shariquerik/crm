import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  docCache,
  fetchCached,
  firstRows,
  QueryCache,
} from '@/data/cache/queryCache'

describe('QueryCache', () => {
  it('reads back what a key was written with', () => {
    const cache = new QueryCache<string>()
    cache.write('a', 'rows', 'CRM Lead')

    expect(cache.read('a')).toBe('rows')
  })

  it('has nothing for a key it was never given', () => {
    expect(new QueryCache<string>().read('a')).toBeUndefined()
  })

  it('forgets an entry once it is older than the age it allows', () => {
    const cache = new QueryCache<string>(20, 1000)
    vi.useFakeTimers()
    try {
      cache.write('a', 'rows', 'CRM Lead')
      vi.advanceTimersByTime(1001)

      expect(cache.read('a')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops the oldest entry once it is full', () => {
    const cache = new QueryCache<string>(2)
    cache.write('a', 'first', 'CRM Lead')
    cache.write('b', 'second', 'CRM Lead')
    cache.write('c', 'third', 'CRM Lead')

    expect(cache.read('a')).toBeUndefined()
    expect(cache.read('c')).toBe('third')
  })

  it('counts a rewrite as recent, so it is not the next to go', () => {
    const cache = new QueryCache<string>(2)
    cache.write('a', 'first', 'CRM Lead')
    cache.write('b', 'second', 'CRM Lead')
    cache.write('a', 'again', 'CRM Lead')
    cache.write('c', 'third', 'CRM Lead')

    expect(cache.read('a')).toBe('again')
    expect(cache.read('b')).toBeUndefined()
  })

  it('invalidates every entry a write to that doctype could have changed', () => {
    const cache = new QueryCache<string>()
    cache.write('open', 'rows', 'CRM Lead')
    cache.write('closed', 'rows', 'CRM Lead')
    cache.write('deals', 'rows', 'CRM Deal')

    cache.invalidate('CRM Lead')

    expect(cache.read('open')).toBeUndefined()
    expect(cache.read('closed')).toBeUndefined()
    expect(cache.read('deals')).toBe('rows')
  })

  it('finds what a route last rendered', () => {
    const cache = new QueryCache<string>()
    cache.write('key', 'rows', 'CRM Lead')
    cache.remember('/CRM Lead', 'key')

    expect(cache.readRoute('/CRM Lead')).toBe('rows')
  })

  it('has nothing for a route whose entry was invalidated', () => {
    const cache = new QueryCache<string>()
    cache.write('key', 'rows', 'CRM Lead')
    cache.remember('/CRM Lead', 'key')

    cache.invalidate('CRM Lead')

    expect(cache.readRoute('/CRM Lead')).toBeUndefined()
  })

  it('has nothing for a route it never rendered', () => {
    expect(new QueryCache<string>().readRoute('/CRM Lead')).toBeUndefined()
  })
})

describe('fetchCached', () => {
  function fakeResource() {
    return {
      setData: vi.fn(),
      fetch: vi.fn((_params: unknown, options: any) =>
        options.onSuccess({ name: 'CRM-LEAD-1' }),
      ),
    }
  }

  beforeEach(() => docCache.clear())

  it('fetches with nothing to paint on a first visit', () => {
    const resource = fakeResource()

    fetchCached(resource, 'record:CRM Lead/1', 'CRM Lead')

    expect(resource.setData).not.toHaveBeenCalled()
    expect(resource.fetch).toHaveBeenCalled()
  })

  it('paints the last answer, and still fetches behind it', () => {
    fetchCached(fakeResource(), 'record:CRM Lead/1', 'CRM Lead')
    const resource = fakeResource()

    fetchCached(resource, 'record:CRM Lead/1', 'CRM Lead')

    expect(resource.setData).toHaveBeenCalledWith({ name: 'CRM-LEAD-1' })
    expect(resource.fetch).toHaveBeenCalled()
  })

  it('has nothing to paint once a write to that doctype lands', () => {
    fetchCached(fakeResource(), 'record:CRM Lead/1', 'CRM Lead')
    docCache.invalidate('CRM Lead')
    const resource = fakeResource()

    fetchCached(resource, 'record:CRM Lead/1', 'CRM Lead')

    expect(resource.setData).not.toHaveBeenCalled()
  })
})

describe('firstRows', () => {
  it('cuts an answer down to the rows this page asks for', () => {
    const answer = { data: [1, 2, 3], total_count: 3 }

    expect(firstRows(answer, 2)).toEqual({ data: [1, 2], total_count: 3 })
  })

  it('leaves an answer that holds no more than was asked for', () => {
    const answer = { data: [1, 2], total_count: 2 }

    expect(firstRows(answer, 20)).toBe(answer)
  })

  it('treats an answer with no rows as the empty list it is', () => {
    expect(firstRows({ data: [] }, 20).data).toEqual([])
  })
})

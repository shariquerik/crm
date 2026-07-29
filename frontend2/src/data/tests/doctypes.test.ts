import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }))

vi.mock('frappe-ui', () => ({
  call: callMock,
  createResource: () => ({ data: null, loading: false, fetch: vi.fn() }),
}))

import { resolveRouteDoctype, routeDoctype } from '@/data/doctypes'

describe('resolveRouteDoctype', () => {
  beforeEach(() => {
    callMock.mockReset()
  })

  it('answers for a doctype this app ships without asking the server', async () => {
    expect(await resolveRouteDoctype('CRM Lead')).toBe('CRM Lead')
    expect(callMock).not.toHaveBeenCalled()
  })

  it('asks the server what an unseen segment names', async () => {
    callMock.mockResolvedValue({ doctype: 'ToDo' })

    expect(await resolveRouteDoctype('todo')).toBe('ToDo')
    expect(callMock).toHaveBeenCalledWith('crm.api.doc.resolve_doctype', {
      doctype: 'todo',
    })
  })

  it('asks once, then answers the same segment from memory', async () => {
    callMock.mockResolvedValue({ doctype: 'Event' })

    await resolveRouteDoctype('event')
    await resolveRouteDoctype('event')

    expect(callMock).toHaveBeenCalledTimes(1)
  })

  it('remembers the name it resolved to, so the redirect costs nothing', async () => {
    callMock.mockResolvedValue({ doctype: 'Web Page' })
    await resolveRouteDoctype('web-page')
    callMock.mockReset()

    expect(await resolveRouteDoctype('Web Page')).toBe('Web Page')
    expect(callMock).not.toHaveBeenCalled()
  })

  it('shares one request between callers that arrive together', async () => {
    callMock.mockResolvedValue({ doctype: 'File' })

    const [first, second] = await Promise.all([
      resolveRouteDoctype('file'),
      resolveRouteDoctype('file'),
    ])

    expect([first, second]).toEqual(['File', 'File'])
    expect(callMock).toHaveBeenCalledTimes(1)
  })

  it('resolves a segment that names nothing to null', async () => {
    callMock.mockResolvedValue({ doctype: null })

    expect(await resolveRouteDoctype('nonsense')).toBe(null)
  })

  it('answers undefined when it could not ask, which is not the same as nothing', async () => {
    callMock.mockRejectedValueOnce(new Error('offline'))

    expect(await resolveRouteDoctype('flaky')).toBeUndefined()

    callMock.mockResolvedValue({ doctype: 'Flaky' })
    expect(await resolveRouteDoctype('flaky')).toBe('Flaky')
  })
})

describe('routeDoctype', () => {
  it('reports what the guard resolved, for a page that has mounted', async () => {
    callMock.mockResolvedValue({ doctype: 'Comment' })
    await resolveRouteDoctype('comment')

    expect(routeDoctype('comment')).toBe('Comment')
    expect(routeDoctype('Comment')).toBe('Comment')
  })

  it('reports null for a segment the server said names nothing', async () => {
    callMock.mockResolvedValue({ doctype: null })
    await resolveRouteDoctype('nothing-here')

    expect(routeDoctype('nothing-here')).toBe(null)
  })

  it('reports undefined for a segment nothing has resolved, so it is not Not Found', () => {
    expect(routeDoctype('never-resolved')).toBeUndefined()
  })
})

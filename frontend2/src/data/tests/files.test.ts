import { describe, expect, it } from 'vitest'

import { toFileActivities, type FileRow } from '@/data/files'

const docinfo = {
  user_info: { 'jane@example.com': { fullname: 'Jane Doe' } },
}

function fileRow(overrides: Partial<FileRow> = {}): FileRow {
  return {
    name: 'file-1',
    file_name: 'contract.pdf',
    file_url: '/files/contract.pdf',
    is_private: 0,
    creation: '2026-08-04 10:00:00',
    owner: 'jane@example.com',
    ...overrides,
  }
}

describe('toFileActivities', () => {
  it('names the owner through user_info', () => {
    const [activity] = toFileActivities([fileRow()], docinfo)

    expect(activity.author?.fullname).toBe('Jane Doe')
    expect(activity.author?.email).toBe('jane@example.com')
  })

  it('falls back to the email of an owner nothing knows', () => {
    const rows = [fileRow({ owner: 'sam@example.com' })]

    expect(toFileActivities(rows, docinfo)[0].author?.fullname).toBe(
      'sam@example.com',
    )
  })

  it('reads oldest first, against a query that answers newest first', () => {
    const rows = [
      fileRow({ name: 'newer', creation: '2026-08-04 11:00:00' }),
      fileRow({ name: 'older', creation: '2026-08-04 09:00:00' }),
    ]

    expect(toFileActivities(rows, docinfo).map((a) => a.key)).toEqual([
      'file:older',
      'file:newer',
    ])
  })

  it('keys each row by its file, so the feed reorders without remounting', () => {
    const rows = [fileRow({ name: 'a' }), fileRow({ name: 'b' })]
    const keys = toFileActivities(rows, docinfo).map((a) => a.key)

    expect(new Set(keys).size).toBe(2)
  })

  it('carries the file itself, timestamped by its upload', () => {
    const [activity] = toFileActivities([fileRow()], docinfo)

    expect(activity.timestamp).toBe('2026-08-04 10:00:00')
    expect(activity.data).toMatchObject({ file_name: 'contract.pdf' })
  })

  it('reads a record with nothing attached as an empty feed', () => {
    expect(toFileActivities(null, docinfo)).toEqual([])
  })
})

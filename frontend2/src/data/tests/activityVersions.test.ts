import { describe, expect, it } from 'vitest'

import { versionChanges } from '@/data/activityVersions'

const labels = { status: 'Status', items: 'Items', qty: 'Quantity' }

function version(data: Record<string, any>) {
  return {
    name: 'VER-01',
    owner: 'jane@example.com',
    data: JSON.stringify(data),
  }
}

function changes(data: Record<string, any>) {
  return versionChanges(version(data), labels)
}

describe('versionChanges', () => {
  it('lays a field change out as a diff the item can draw an arrow through', () => {
    expect(changes({ changed: [['status', 'Open', 'Closed']] })).toEqual([
      {
        type: 'diff',
        name: 'VER-01:0',
        fieldname: 'status',
        prefix: 'changed Status',
        from: 'Open',
        to: 'Closed',
      },
    ])
  })

  it('reads a change out of blank as setting a value, so no arrow is drawn', () => {
    const [change] = changes({ changed: [['status', null, 'Open']] })
    expect(change).toMatchObject({ prefix: 'set Status to', to: 'Open' })
    expect(change).not.toHaveProperty('from')
  })

  it('falls back to the fieldname when the layout does not carry it', () => {
    expect(changes({ changed: [['secret_code', 'a', 'b']] })[0]).toMatchObject({
      prefix: 'changed secret_code',
    })
  })

  it('keeps every field a bulk edit touched, for the group to fold', () => {
    const changed = ['a', 'b', 'c', 'd', 'e'].map((field) => [field, '1', '2'])
    expect(changes({ changed })).toHaveLength(5)
  })

  it('reads a change into blank as clearing the field, which has no `to`', () => {
    expect(changes({ changed: [['status', 'Open', '']] })).toEqual([
      { type: 'phrase', name: 'VER-01:0', text: 'cleared Status' },
    ])
  })

  it('reads a docstatus change as submit and cancel', () => {
    expect(changes({ changed: [['docstatus', 0, 1]] })).toEqual([
      { type: 'phrase', name: 'VER-01:0', text: 'submitted this document' },
    ])
    expect(changes({ changed: [['docstatus', 1, 2]] })[0]).toMatchObject({
      text: 'cancelled this document',
    })
  })

  it('counts the rows added to and removed from a child table', () => {
    const summaries = changes({
      added: [
        ['items', {}],
        ['items', {}],
      ],
      removed: [['items', {}]],
    })
    expect(summaries.map((change: any) => change.text)).toEqual([
      'added 2 rows to Items',
      'removed 1 row from Items',
    ])
  })

  it('names the child table a row edit touched', () => {
    const summaries = changes({
      row_changed: [['items', 0, 'ROW-1', [['qty', 1, 2]]]],
    })
    expect(summaries.map((change: any) => change.text)).toEqual([
      'changed the values in Items',
    ])
  })

  it('passes a version comment through as its own phrase', () => {
    expect(changes({ comment: 'Reverted to an earlier version' })).toEqual([
      {
        type: 'phrase',
        name: 'VER-01:0',
        text: 'Reverted to an earlier version',
      },
    ])
  })

  it('gives every change in one version a name of its own', () => {
    const names = changes({
      changed: [['status', 'Open', 'Closed']],
      added: [['items', {}]],
    }).map((change) => change.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('says nothing about a version that recorded nothing', () => {
    expect(changes({})).toEqual([])
    expect(
      versionChanges({ name: 'VER-02', data: 'not json' }, labels),
    ).toEqual([])
    expect(versionChanges({ name: 'VER-03' }, labels)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import {
  collidingFields,
  fieldDiff,
  isTimestampMismatch,
  toRecordPayload,
} from '@/data/recordDoc'

const response = {
  docs: [{ name: 'CRM-LEAD-0001', lead_name: 'Jane' }],
  docinfo: { comments: [], assignments: ['jane@example.com'] },
  _link_titles: { 'User::jane@example.com': 'Jane Doe' },
}

describe('toRecordPayload', () => {
  it('reads the document off docs, where getdoc answers', () => {
    expect(toRecordPayload(response)?.doc.lead_name).toBe('Jane')
  })

  it('carries docinfo and the link titles across', () => {
    const payload = toRecordPayload(response)

    expect(payload?.docinfo.assignments).toEqual(['jane@example.com'])
    expect(payload?.linkTitles['User::jane@example.com']).toBe('Jane Doe')
  })

  it('leaves an answer with neither bucket usable', () => {
    const payload = toRecordPayload({ docs: [{ name: 'x' }] })

    expect(payload?.docinfo).toEqual({})
    expect(payload?.linkTitles).toEqual({})
  })

  it('hands back an already-transformed payload untouched', () => {
    const payload = toRecordPayload(response)

    expect(toRecordPayload(payload)).toBe(payload)
  })
})

describe('fieldDiff', () => {
  it('reports a field the reader changed', () => {
    expect(fieldDiff({ status: 'Open' }, { status: 'Lead' })).toEqual({
      status: 'Open',
    })
  })

  it('reports nothing when a value is edited back', () => {
    expect(fieldDiff({ status: 'Lead' }, { status: 'Lead' })).toEqual({})
  })

  it('compares child tables by value', () => {
    const stored = { products: [{ item: 'A', qty: 1 }] }

    expect(fieldDiff({ products: [{ item: 'A', qty: 1 }] }, stored)).toEqual({})
    expect(fieldDiff({ products: [{ item: 'A', qty: 2 }] }, stored)).toEqual({
      products: [{ item: 'A', qty: 2 }],
    })
  })

  it('reads a missing field as the null a save endpoint returns', () => {
    expect(fieldDiff({ website: null }, {})).toEqual({})
    expect(fieldDiff({}, { website: null })).toEqual({})
  })

  it('reports a field the other side cleared, and invents no value for it', () => {
    const changes = fieldDiff({}, { website: 'crm.com' })

    expect(Object.keys(changes)).toEqual(['website'])
    expect(changes.website).toBeUndefined()
  })

  it('still reports a field cleared to null', () => {
    expect(fieldDiff({ website: null }, { website: 'crm.com' })).toEqual({
      website: null,
    })
  })

  it('does not read an empty string as blank', () => {
    expect(fieldDiff({ website: '' }, { website: null })).toEqual({
      website: '',
    })
  })
})

describe('collidingFields', () => {
  it('is empty when two people changed different fields', () => {
    expect(collidingFields({ status: 'Open' }, { website: 'crm.com' })).toEqual(
      [],
    )
  })

  it('names the fields both of them changed', () => {
    const mine = { status: 'Open', website: 'crm.com' }
    const theirs = { status: 'Replied', lead_name: 'Jane' }

    expect(collidingFields(mine, theirs)).toEqual(['status'])
  })

  it('does not collide on a field they both set to the same value', () => {
    expect(collidingFields({ status: 'Open' }, { status: 'Open' })).toEqual([])
  })
})

describe('isTimestampMismatch', () => {
  it('knows the record moved underneath the save', () => {
    expect(isTimestampMismatch({ exc_type: 'TimestampMismatchError' })).toBe(
      true,
    )
  })

  it('leaves every other failure alone', () => {
    expect(isTimestampMismatch({ exc_type: 'ValidationError' })).toBe(false)
    expect(isTimestampMismatch(new Error('offline'))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import {
  collidingFields,
  conflictRows,
  fieldDiff,
  isTimestampMismatch,
  recordIdentity,
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

describe('conflictRows', () => {
  const fields = {
    annual_revenue: {
      fieldname: 'annual_revenue',
      fieldtype: 'Currency',
      label: 'Annual Revenue',
    },
  }

  it('names a field by its label and carries both values', () => {
    const rows = conflictRows(
      ['annual_revenue'],
      { annual_revenue: 65000 },
      { annual_revenue: 50000 },
      fields,
    )

    expect(rows).toEqual([
      {
        fieldname: 'annual_revenue',
        label: 'Annual Revenue',
        mine: { value: 65000, display: '65,000.00' },
        theirs: { value: 50000, display: '50,000.00' },
      },
    ])
  })

  it("reads a Currency field in the record's own currency", () => {
    const currencyFields = {
      deal_value: {
        fieldname: 'deal_value',
        fieldtype: 'Currency',
        label: 'Deal Value',
        options: 'currency',
      },
    }
    const [row] = conflictRows(
      ['deal_value'],
      { deal_value: 1000 },
      { deal_value: 2000 },
      currencyFields,
      { currency: 'USD' },
    )

    expect(row.mine.display).toBe('$ 1,000.00')
  })

  it('falls back to the fieldname where the layout carries no such field', () => {
    const [row] = conflictRows(['website'], { website: 'crm.com' }, {}, fields)

    expect(row.label).toBe('website')
    expect(row.mine.display).toBe('crm.com')
    expect(row.theirs.display).toBe('Empty')
  })

  it('reads a child table as a row count, which is how it is picked', () => {
    const [row] = conflictRows(
      ['products'],
      { products: [{ item: 'A' }] },
      { products: [{ item: 'A' }, { item: 'B' }] },
      fields,
    )

    expect(row.mine.display).toBe('1 row')
    expect(row.theirs.display).toBe('2 rows')
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

describe('recordIdentity', () => {
  const contact = { name: 'CONTACT-0001', full_name: 'Emma Chen', image: '/i' }

  it('titles the record by the meta title field, over its ID', () => {
    const identity = recordIdentity(
      contact,
      { title_field: 'full_name', image_field: 'image' },
      'Contacts',
    )
    expect(identity).toEqual({
      title: 'Emma Chen',
      subtitle: 'CONTACT-0001',
      image: '/i',
    })
  })

  it('names the doctype below a title that is already the ID', () => {
    const identity = recordIdentity(contact, null, 'Contacts')
    expect(identity).toEqual({
      title: 'CONTACT-0001',
      subtitle: 'Contacts',
      image: '',
    })
  })

  it('falls back to the ID when the title field is empty', () => {
    const identity = recordIdentity(
      { name: 'CONTACT-0002' },
      { title_field: 'full_name' },
      'Contacts',
    )
    expect(identity.title).toBe('CONTACT-0002')
  })
})

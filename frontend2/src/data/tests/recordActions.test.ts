import { describe, expect, it } from 'vitest'

import { duplicatePayload, printUrl } from '@/data/recordActions'

const contact = {
  doctype: 'Contact',
  name: 'CONTACT-0001',
  owner: 'jane@example.com',
  creation: '2026-01-01 10:00:00',
  modified: '2026-01-02 10:00:00',
  modified_by: 'jane@example.com',
  docstatus: 0,
  idx: 3,
  _user_tags: 'champion',
  _assign: '["jane@example.com"]',
  first_name: 'Emma',
  email_ids: [
    {
      doctype: 'Contact Email',
      name: 'row-1',
      parent: 'CONTACT-0001',
      parentfield: 'email_ids',
      creation: '2026-01-01 10:00:00',
      email_id: 'emma@example.com',
    },
  ],
}

describe('duplicatePayload', () => {
  const copy = duplicatePayload(contact)

  it('keeps the doctype and every value the reader typed', () => {
    expect(copy.doctype).toBe('Contact')
    expect(copy.first_name).toBe('Emma')
  })

  it('drops the identity and the audit trail of the original', () => {
    for (const key of [
      'name',
      'owner',
      'creation',
      'modified',
      'modified_by',
      'idx',
      '_user_tags',
      '_assign',
    ])
      expect(copy).not.toHaveProperty(key)
  })

  it('leaves the original untouched', () => {
    expect(contact.name).toBe('CONTACT-0001')
    expect(contact.email_ids[0].name).toBe('row-1')
  })

  it('carries child rows over, stripped of their own identity', () => {
    const [row] = copy.email_ids
    expect(row).toEqual({
      doctype: 'Contact Email',
      parentfield: 'email_ids',
      email_id: 'emma@example.com',
    })
  })

  it('submits as a draft, whatever the original was', () => {
    expect(duplicatePayload({ ...contact, docstatus: 1 }).docstatus).toBe(0)
  })
})

describe('printUrl', () => {
  it('escapes a doctype and a name that carry spaces', () => {
    expect(printUrl('CRM Deal', 'DEAL 0001')).toBe(
      '/printview?doctype=CRM%20Deal&name=DEAL%200001&trigger_print=1',
    )
  })
})

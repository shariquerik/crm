import { describe, expect, it } from 'vitest'
import type { FormLayoutSchema } from '@framework/ui/components/FormLayout'

import {
  commentArgs,
  emailArgs,
  emptyDraft,
  openDraft,
  recordEmail,
  type Draft,
} from '@/data/composer'

const layout: FormLayoutSchema = [
  {
    sections: [
      {
        columns: [
          {
            fields: [
              { fieldname: 'first_name', fieldtype: 'Data' },
              { fieldname: 'email_id', fieldtype: 'Data', options: 'Email' },
              { fieldname: 'alt_email', fieldtype: 'Data', options: 'Email' },
            ],
          },
        ],
      },
    ],
  },
]

const record = {
  docname: 'jane',
  doc: { email_id: 'jane@example.com' },
  layout,
}

const attachment = {
  name: 'file-1',
  file_name: 'contract.pdf',
  file_url: '/files/contract.pdf',
  file_type: 'pdf',
}

describe('commentArgs', () => {
  it('carries the reference and the attachments by File name', () => {
    const args = commentArgs('Contact', 'jane', {
      body: '<p>Hello</p>',
      attachments: [attachment],
    })

    expect(args).toEqual({
      reference_doctype: 'Contact',
      reference_name: 'jane',
      content: '<p>Hello</p>',
      attachments: ['file-1'],
    })
  })
})

describe('emailArgs', () => {
  const payload = {
    from: '',
    subject: 'Re: jane',
    body: '<p>Hello</p>',
    recipients: {
      to: [{ email: 'jane@example.com' }],
      cc: [{ email: 'sam@example.com' }, { email: 'lee@example.com' }],
      bcc: [],
    },
    attachments: [],
  }

  const sender = { email: 'me@example.com', fullName: 'Me' }

  it('joins each address list with a comma', () => {
    const args = emailArgs('Contact', 'jane', sender, payload)

    expect(args.recipients).toBe('jane@example.com')
    expect(args.cc).toBe('sam@example.com, lee@example.com')
    expect(args.bcc).toBe('')
  })

  it('sends as the session user', () => {
    const args = emailArgs('Contact', 'jane', sender, payload)

    expect(args.sender).toBe('me@example.com')
    expect(args.sender_full_name).toBe('Me')
    expect(args.send_email).toBe(1)
  })
})

describe('recordEmail', () => {
  it('takes the first Email field the record fills', () => {
    const doc = { first_name: 'Jane', alt_email: 'jane@example.com' }

    expect(recordEmail({ ...record, doc })).toBe('jane@example.com')
  })

  it('is empty when no Email field is filled', () => {
    expect(recordEmail({ ...record, doc: { first_name: 'Jane' } })).toBe('')
  })
})

describe('openDraft', () => {
  const typed: Draft = { ...emptyDraft(), body: '<p>Half a thought</p>' }

  it('addresses a reply from the record', () => {
    const draft = openDraft(emptyDraft(), 'reply', record)

    expect(draft.open).toBe(true)
    expect(draft.subject).toBe('Re: jane')
    expect(draft.recipients.to).toEqual([{ email: 'jane@example.com' }])
  })

  it('leaves the recipients empty when the record has no address', () => {
    const draft = openDraft(emptyDraft(), 'reply', { ...record, doc: {} })

    expect(draft.recipients.to).toEqual([])
  })

  it('keeps what was typed, in either mode', () => {
    expect(openDraft(typed, 'comment', record).body).toBe(typed.body)
    expect(openDraft(typed, 'reply', record).body).toBe(typed.body)
  })

  it('addresses a reply opened over a comment draft', () => {
    const draft = openDraft(typed, 'reply', record)

    expect(draft.subject).toBe('Re: jane')
    expect(draft.recipients.to).toEqual([{ email: 'jane@example.com' }])
  })

  it('keeps an envelope the reader already edited', () => {
    const edited: Draft = {
      ...emptyDraft(),
      mode: 'reply',
      subject: 'About the contract',
      recipients: { to: [{ email: 'sam@example.com' }], cc: [], bcc: [] },
    }

    const draft = openDraft(edited, 'reply', record)

    expect(draft.subject).toBe('About the contract')
    expect(draft.recipients.to).toEqual([{ email: 'sam@example.com' }])
  })

  it('drops markup an emptied editor left behind', () => {
    const blank: Draft = { ...emptyDraft(), body: '<p></p>' }

    expect(openDraft(blank, 'comment', record).body).toBe('')
  })
})

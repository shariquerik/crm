import { describe, expect, it } from 'vitest'

import { activityFeed } from '@/data/activity'

const doc = {
  name: 'Jane',
  owner: 'jane@example.com',
  creation: '2026-01-01 09:00:00',
  modified: '2026-01-05 17:00:00',
  modified_by: 'dev@example.com',
}

const userInfo = {
  'jane@example.com': { fullname: 'Jane Doe', image: '/jane.png' },
  'dev@example.com': { fullname: 'Dev Kumar' },
}

function feed(buckets: Record<string, any> = {}, labels = {}) {
  return activityFeed(doc, { user_info: userInfo, ...buckets }, labels)
}

function texts(buckets: Record<string, any> = {}, labels = {}) {
  return feed(buckets, labels).map((activity: any) => activity.data.text)
}

describe('activityFeed', () => {
  it('opens and closes on the synthetic created and edited entries', () => {
    expect(texts()).toEqual([
      'Jane Doe created this',
      'Dev Kumar last edited this',
    ])
  })

  it('names the actor in the log text, which is how the row bolds them', () => {
    const [created] = feed()
    expect(created.data.text).toContain(created.author?.fullname)
  })

  it('leaves out the edited entry on a record nobody has touched', () => {
    const entries = activityFeed(
      { ...doc, modified: doc.creation, modified_by: doc.owner },
      { user_info: userInfo },
      {},
    )
    expect(entries).toHaveLength(1)
  })

  it('falls back to the email for an actor user_info does not name', () => {
    const [, view] = feed({
      views: [{ name: 'V1', creation: '2026-01-02', owner: 'nobody@x.com' }],
    })
    expect(view.author).toMatchObject({
      email: 'nobody@x.com',
      fullname: 'nobody@x.com',
    })
  })

  it('orders every bucket into one feed, oldest first', () => {
    const entries = feed({
      comments: [
        { name: 'C1', creation: '2026-01-03 10:00:00', content: '<p>hi</p>' },
      ],
      communications: [
        {
          name: 'E1',
          communication_date: '2026-01-02 10:00:00',
          sender: 'b@x.com',
        },
      ],
    })
    expect(entries.map((activity) => activity.timestamp)).toEqual([
      '2026-01-01 09:00:00',
      '2026-01-02 10:00:00',
      '2026-01-03 10:00:00',
      '2026-01-05 17:00:00',
    ])
  })

  it('carries a comment with its rendered body', () => {
    const [comment] = feed({
      comments: [
        {
          name: 'C1',
          creation: '2026-01-02',
          content: '<p>hi</p>',
          comment_email: 'jane@example.com',
        },
      ],
    }).filter((activity) => activity.type === 'comment')
    expect(comment).toMatchObject({
      key: 'comment:C1',
      data: { name: 'C1', content: '<p>hi</p>' },
    })
    expect(comment.author?.image).toBe('/jane.png')
  })

  it('carries an email with its envelope', () => {
    const [email] = feed({
      communications: [
        {
          name: 'E1',
          communication_date: '2026-01-02',
          subject: 'Quote',
          sender: 'jane@example.com',
          recipients: 'dev@example.com',
          cc: 'cc@x.com',
          content: '<p>body</p>',
          delivery_status: 'Sent',
        },
      ],
    }).filter((activity) => activity.type === 'email')
    expect(email).toMatchObject({
      key: 'email:E1',
      data: {
        subject: 'Quote',
        to: 'dev@example.com',
        cc: 'cc@x.com',
        deliveryStatus: 'Sent',
      },
    })
  })

  it('parses the attachments an email carries as a JSON string', () => {
    const [email] = feed({
      communications: [
        {
          name: 'E1',
          creation: '2026-01-02',
          sender: 'jane@example.com',
          attachments: '[{"file_url": "/files/quote.pdf"}]',
        },
      ],
    }).filter((activity) => activity.type === 'email')
    expect(email.data.attachments).toEqual([{ file_url: '/files/quote.pdf' }])
  })

  it('reads an email carrying no attachments at all as none', () => {
    const [email] = feed({
      communications: [
        { name: 'E1', creation: '2026-01-02', sender: 'a@x.com' },
      ],
    }).filter((activity) => activity.type === 'email')
    expect(email.data.attachments).toEqual([])
  })

  it('gives each log kind the subtype its gutter icon keys off', () => {
    const entries = feed({
      views: [
        { name: 'V1', creation: '2026-01-02', owner: 'jane@example.com' },
      ],
      like_logs: [
        { name: 'L1', creation: '2026-01-03', owner: 'jane@example.com' },
      ],
      workflow_logs: [
        {
          name: 'W1',
          creation: '2026-01-04',
          owner: 'jane@example.com',
          content: 'Approved',
        },
      ],
      assignment_logs: [
        {
          name: 'A1',
          creation: '2026-01-04 12:00:00',
          owner: 'jane@example.com',
          comment_type: 'Assigned',
          content: '<div>Assigned to Dev Kumar</div>',
        },
      ],
    })
    expect(entries.map((activity: any) => activity.data.subtype)).toEqual([
      'created',
      'view',
      'like',
      'workflow',
      'assigned',
      'info',
    ])
  })

  it('strips the markup a log entry arrives wrapped in', () => {
    expect(
      texts({
        info_logs: [
          {
            name: 'I1',
            creation: '2026-01-02',
            content: '<div>renamed to Jane</div>',
          },
        ],
      }),
    ).toContain('renamed to Jane')
  })

  it('tells an assignment from its completion', () => {
    const [, completed] = feed({
      assignment_logs: [
        {
          name: 'A1',
          creation: '2026-01-02',
          comment_type: 'Assignment Completed',
          content: 'Assignment closed',
        },
      ],
    })
    expect(completed.data.subtype).toBe('assignment_completed')
  })

  it('reads a share and a milestone as info logs naming what happened', () => {
    expect(
      texts(
        {
          shared: [
            {
              name: 'S1',
              creation: '2026-01-02',
              owner: 'jane@example.com',
              user: 'dev@example.com',
            },
          ],
          milestones: [
            {
              creation: '2026-01-03',
              owner: 'jane@example.com',
              track_field: 'status',
              value: 'Won',
            },
          ],
        },
        { status: 'Status' },
      ),
    ).toEqual([
      'Jane Doe created this',
      'Jane Doe shared this with dev@example.com',
      'Jane Doe changed Status to Won',
      'Dev Kumar last edited this',
    ])
  })

  it('says everyone for a share that names no user', () => {
    expect(
      texts({
        shared: [
          {
            name: 'S1',
            creation: '2026-01-02',
            owner: 'jane@example.com',
            everyone: 1,
          },
        ],
      }),
    ).toContain('Jane Doe shared this with everyone')
  })

  it('pulls the file name and its link out of an attachment log', () => {
    const [, added, removed] = feed({
      attachment_logs: [
        {
          name: 'AT1',
          creation: '2026-01-02',
          comment_type: 'Attachment',
          content: '<a href="/private/files/quote.pdf">quote.pdf</a>',
        },
        {
          name: 'AT2',
          creation: '2026-01-03',
          comment_type: 'Attachment Removed',
          content: 'old.pdf',
        },
      ],
    })
    expect(added).toMatchObject({
      type: 'attachment_log',
      key: 'attachment:AT1',
      data: {
        action: 'added',
        fileName: 'quote.pdf',
        fileUrl: '/private/files/quote.pdf',
        isPrivate: true,
      },
    })
    expect(removed.data).toMatchObject({
      action: 'removed',
      fileName: 'old.pdf',
    })
    expect(removed.data).not.toHaveProperty('fileUrl')
  })

  it('folds one version into a single row, grouping what it changed', () => {
    const [version] = feed(
      {
        versions: [
          {
            name: 'V1',
            creation: '2026-01-02',
            owner: 'jane@example.com',
            data: JSON.stringify({
              changed: [['status', 'Open', 'Closed']],
              added: [['items', {}]],
            }),
          },
        ],
      },
      { status: 'Status' },
    ).filter((activity) => activity.type === 'version')
    expect(version.key).toBe('version:V1')
    expect(version.data.group).toHaveLength(2)
    expect(version.data).toMatchObject({
      type: 'diff',
      prefix: 'changed Status',
    })
  })

  it('leaves a lone change ungrouped, so no chevron is drawn', () => {
    const [version] = feed({
      versions: [
        {
          name: 'V1',
          creation: '2026-01-02',
          data: JSON.stringify({ changed: [['status', 'Open', 'Closed']] }),
        },
      ],
    }).filter((activity) => activity.type === 'version')
    expect(version.data).not.toHaveProperty('group')
  })

  it('drops a version that recorded nothing worth showing', () => {
    const entries = feed({
      versions: [{ name: 'V1', creation: '2026-01-02', data: '{}' }],
    })
    expect(entries.filter((activity) => activity.type === 'version')).toEqual(
      [],
    )
  })

  it('prefixes every key by its type, and gives each row one of its own', () => {
    const entries = feed({
      comments: [
        { name: 'C1', creation: '2026-01-02', content: 'a' },
        { name: 'C2', creation: '2026-01-03', content: 'b' },
      ],
      milestones: [
        { creation: '2026-01-02', track_field: 'status', value: 'A' },
        { creation: '2026-01-03', track_field: 'status', value: 'B' },
      ],
    })
    const keys = entries.map((activity) => activity.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const activity of entries)
      expect(activity.key.split(':')[0]).toMatch(
        /^(comment|email|log|attachment|version)$/,
      )
  })

  it('reads an empty docinfo without falling over', () => {
    expect(activityFeed({}, {}, {})).toEqual([])
    expect(activityFeed(doc, {}, {})).toHaveLength(2)
  })
})

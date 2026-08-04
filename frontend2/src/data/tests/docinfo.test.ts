import { describe, expect, it } from 'vitest'

import {
  applyDocinfoUpdate,
  assigneesOf,
  assignmentDiff,
  isForRecord,
  type DocinfoUpdate,
} from '@/data/docinfo'

function delta(overrides: Partial<DocinfoUpdate> = {}): DocinfoUpdate {
  return {
    key: 'comments',
    action: 'add',
    doc: {
      name: 'COMMENT-0002',
      content: 'second',
      reference_doctype: 'Contact',
      reference_name: 'Jane',
    },
    ...overrides,
  }
}

const docinfo = {
  comments: [{ name: 'COMMENT-0001', content: 'first' }],
  like_logs: [],
}

describe('isForRecord', () => {
  it('accepts a delta pointing at the record on screen', () => {
    expect(isForRecord(delta(), 'Contact', 'Jane')).toBe(true)
  })

  it('rejects another record of the same doctype', () => {
    expect(isForRecord(delta(), 'Contact', 'Dev')).toBe(false)
  })

  it('rejects a delta carrying no reference at all', () => {
    expect(isForRecord(delta({ doc: { name: 'X' } }), 'Contact', 'Jane')).toBe(
      false,
    )
  })
})

describe('applyDocinfoUpdate', () => {
  it('appends an added row to its own bucket', () => {
    const updated = applyDocinfoUpdate(docinfo, delta())

    expect(updated.comments.map((row: any) => row.name)).toEqual([
      'COMMENT-0001',
      'COMMENT-0002',
    ])
  })

  it('replaces an updated row in place', () => {
    const edit = delta({
      action: 'update',
      doc: { name: 'COMMENT-0001', content: 'edited' },
    })

    expect(applyDocinfoUpdate(docinfo, edit).comments).toEqual([
      { name: 'COMMENT-0001', content: 'edited' },
    ])
  })

  it('drops a deleted row', () => {
    const removal = delta({
      action: 'delete',
      doc: { name: 'COMMENT-0001' },
    })

    expect(applyDocinfoUpdate(docinfo, removal).comments).toEqual([])
  })

  it('treats a missing action as an update, as the desk form does', () => {
    const edit = delta({
      action: undefined,
      doc: { name: 'COMMENT-0001', content: 'edited' },
    })

    expect(applyDocinfoUpdate(docinfo, edit).comments[0].content).toBe('edited')
  })

  it('ignores an update or delete for a row it does not hold', () => {
    const edit = delta({ action: 'update', doc: { name: 'COMMENT-0009' } })

    expect(applyDocinfoUpdate(docinfo, edit).comments).toEqual(docinfo.comments)
  })

  it('starts a bucket the response never carried', () => {
    expect(
      applyDocinfoUpdate(docinfo, delta({ key: 'views' })).views,
    ).toHaveLength(1)
  })

  it('leaves every other bucket untouched', () => {
    const updated = applyDocinfoUpdate(docinfo, delta())

    expect(updated.like_logs).toBe(docinfo.like_logs)
  })
})

describe('assigneesOf', () => {
  const assigned = {
    assignments: [{ owner: 'jane@example.com' }, { owner: 'dev@example.com' }],
    user_info: {
      'jane@example.com': { fullname: 'Jane Doe', image: '/jane.png' },
    },
  }

  it('names each assignee from user_info', () => {
    expect(assigneesOf(assigned)[0]).toEqual({
      email: 'jane@example.com',
      fullName: 'Jane Doe',
      image: '/jane.png',
    })
  })

  it('falls back to the email when user_info has no entry', () => {
    expect(assigneesOf(assigned)[1].fullName).toBe('dev@example.com')
  })

  it('reads an unassigned record as nobody', () => {
    expect(assigneesOf({})).toEqual([])
  })
})

describe('assignmentDiff', () => {
  const assignees = [
    { email: 'jane@example.com', fullName: 'Jane Doe', image: '' },
    { email: 'dev@example.com', fullName: 'Dev Patel', image: '' },
  ]

  it('reports nothing for a selection that did not move', () => {
    const picked = ['jane@example.com', 'dev@example.com']

    expect(assignmentDiff(picked, assignees)).toEqual({
      added: [],
      dropped: [],
    })
  })

  it('reports the one email a pick added', () => {
    const picked = ['jane@example.com', 'dev@example.com', 'sam@example.com']

    expect(assignmentDiff(picked, assignees).added).toEqual(['sam@example.com'])
  })

  it('reports the one email a pick dropped', () => {
    expect(assignmentDiff(['jane@example.com'], assignees).dropped).toEqual([
      'dev@example.com',
    ])
  })

  it('reads a cleared selection as dropping everyone', () => {
    expect(assignmentDiff([], assignees).dropped).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'

import { canCreateTag, matchingTags, tagColor, tagsOf } from '@/data/tags'

describe('tagsOf', () => {
  it('splits the comma-joined string getdoc answers with', () => {
    expect(tagsOf({ tags: 'champion,renewal' })).toEqual([
      'champion',
      'renewal',
    ])
  })

  it('trims and drops the empties a trailing comma leaves', () => {
    expect(tagsOf({ tags: 'champion, ,renewal,' })).toEqual([
      'champion',
      'renewal',
    ])
  })

  it('reads a record with no tags as none', () => {
    expect(tagsOf({ tags: '' })).toEqual([])
    expect(tagsOf({})).toEqual([])
  })

  it('takes a list as it stands, for a server that stopped joining', () => {
    expect(tagsOf({ tags: ['champion'] })).toEqual(['champion'])
  })
})

describe('matchingTags', () => {
  const known = ['champion', 'Decision Maker', 'renewal']

  it('keeps every tag while nothing is typed', () => {
    expect(matchingTags(known, '')).toEqual(known)
  })

  it('matches on a substring, ignoring case', () => {
    expect(matchingTags(known, 'ION')).toEqual(['champion', 'Decision Maker'])
  })

  it('ignores the space around what was typed', () => {
    expect(matchingTags(known, '  renew ')).toEqual(['renewal'])
  })
})

describe('canCreateTag', () => {
  it('offers to create a name nothing matches exactly', () => {
    expect(canCreateTag(['champion'], 'blocker')).toBe(true)
  })

  it('refuses a name that already exists, whatever its case', () => {
    expect(canCreateTag(['Champion'], 'champion')).toBe(false)
  })

  it('refuses a blank name', () => {
    expect(canCreateTag([], '   ')).toBe(false)
  })
})

describe('tagColor', () => {
  it('gives one tag the same colour every time', () => {
    expect(tagColor('champion')).toBe(tagColor('champion'))
  })

  it('names a generated tailwind class', () => {
    expect(tagColor('renewal')).toMatch(/^bg-[a-z]+-500$/)
  })
})

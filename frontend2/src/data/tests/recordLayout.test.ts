import { describe, expect, it } from 'vitest'

import { RECORD_TABS, activeTab } from '@/data/recordLayout'

describe('RECORD_TABS', () => {
  it('satisfies NavigationItem, naming each tab by its type', () => {
    for (const tab of RECORD_TABS) {
      expect(tab.name).toBe(tab.type)
      expect(tab.label).toBeTruthy()
      expect(tab.icon).toBeTruthy()
      expect(tab).toMatchObject({ dt: '', url: '', hidden: 0, view: null })
    }
  })

  it('opens on Activity, the conversation surface', () => {
    expect(RECORD_TABS[0]?.type).toBe('activity')
  })

  it('ends on Details, the overflow surface', () => {
    expect(RECORD_TABS.at(-1)?.type).toBe('details')
  })
})

describe('activeTab', () => {
  it('picks the tab the name asks for', () => {
    expect(activeTab(RECORD_TABS, 'details')?.type).toBe('details')
  })

  it('opens the first tab when the name is absent', () => {
    expect(activeTab(RECORD_TABS, undefined)).toBe(RECORD_TABS[0])
  })

  it('opens the first tab when nothing answers to the name', () => {
    expect(activeTab(RECORD_TABS, 'nonsense')).toBe(RECORD_TABS[0])
  })
})

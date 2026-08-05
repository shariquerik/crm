import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import {
  clampWidth,
  divergencesOf,
  dragOutcome,
  openState,
  usePanelState,
} from '@/composables/usePanelState'

const sections = [
  {
    name: 'contact_details',
    label: 'Contact Details',
    opened: true,
    columns: [],
  },
  { name: 'other', label: 'Other', opened: false, columns: [] },
]

const layout = [{ name: 'main', label: 'Details', sections }]

describe('clampWidth', () => {
  it('keeps a dragged width inside the range', () => {
    expect(clampWidth(420)).toBe(420)
    expect(clampWidth(120)).toBe(320)
    expect(clampWidth(900)).toBe(640)
  })

  it('falls back to the default for a value that is not a number', () => {
    expect(clampWidth(NaN)).toBe(380)
  })
})

describe('dragOutcome', () => {
  it('resizes an open panel by how far the edge moved', () => {
    expect(dragOutcome(true, 380, 60)).toEqual({ width: 440 })
    expect(dragOutcome(true, 380, -40)).toEqual({ width: 340 })
  })

  it('holds the panel at the range ends', () => {
    expect(dragOutcome(true, 600, 200)).toEqual({ width: 640 })
  })

  it('collapses when the drag passes the threshold', () => {
    expect(dragOutcome(true, 380, -130)).toEqual({ toggle: true })
  })

  it('reopens a rail only once the drag is long enough', () => {
    expect(dragOutcome(false, 380, 20)).toEqual({})
    expect(dragOutcome(false, 380, 40)).toEqual({ toggle: true })
  })
})

describe('openState', () => {
  it("follows the layout's defaults where nothing diverged", () => {
    expect(openState(sections, {})).toEqual({
      contact_details: true,
      other: false,
    })
  })

  it('overrides a default the reader diverged from', () => {
    expect(openState(sections, { other: true })).toEqual({
      contact_details: true,
      other: true,
    })
  })

  it('ignores a stored name the layout no longer carries', () => {
    expect(openState(sections, { gone: true }).gone).toBeUndefined()
  })

  it('reads a section with no opened flag as open', () => {
    expect(openState([{ name: 'plain', columns: [] }], {})).toEqual({
      plain: true,
    })
  })
})

describe('divergencesOf', () => {
  it('stores nothing while every section sits at its default', () => {
    expect(
      divergencesOf(sections, { contact_details: true, other: false }),
    ).toEqual({})
  })

  it('stores only the sections that differ', () => {
    expect(
      divergencesOf(sections, { contact_details: false, other: false }),
    ).toEqual({
      contact_details: false,
    })
  })

  it('drops an entry toggled back to its default', () => {
    const stored = divergencesOf(sections, {
      contact_details: true,
      other: true,
    })

    expect(divergencesOf(sections, openState(sections, stored))).toEqual({
      other: true,
    })
    expect(
      divergencesOf(sections, { contact_details: true, other: false }),
    ).toEqual({})
  })
})

describe('usePanelState', () => {
  beforeEach(() => localStorage.clear())

  it('opens expanded at 380px on a first visit', () => {
    const panel = usePanelState('Contact', () => layout)

    expect(panel.width.value).toBe(380)
    expect(panel.collapsed.value).toBe(false)
  })

  it('clamps a stored width on read as well as on drag', () => {
    localStorage.setItem('crm-panel-width', '1200')

    expect(usePanelState('Contact', () => layout).width.value).toBe(640)
  })

  it('keeps open sections under a key of their own doctype', async () => {
    const panel = usePanelState('Contact', () => layout)

    panel.openSections.value = { contact_details: false, other: false }
    await nextTick()

    expect(localStorage.getItem('crm-panel-sections:Contact')).toBe(
      '{"contact_details":false}',
    )
  })

  it('hands PanelLayout an effective boolean for every section', () => {
    localStorage.setItem('crm-panel-sections:Contact', '{"other":true}')

    expect(usePanelState('Contact', () => layout).openSections.value).toEqual({
      contact_details: true,
      other: true,
    })
  })
})

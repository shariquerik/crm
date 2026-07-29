import { describe, expect, it } from 'vitest'

import type {
  NavigationItem,
  NavigationSection,
} from '@framework/ui/components/Navigation'
import {
  flattenRail,
  isActiveRailItem,
  railDoctypes,
  railHomeRoute,
  type RailItem,
} from '@/data/rail'

function item(overrides: Partial<NavigationItem>): NavigationItem {
  return {
    name: 'row',
    type: 'doctype',
    label: 'Leads',
    icon: '',
    dt: 'CRM Lead',
    url: '/CRM%20Lead',
    new_tab: 0,
    hidden: 0,
    own: 0,
    view: null,
    ...overrides,
  }
}

function section(
  name: string,
  items: NavigationItem[],
  user = '',
): NavigationSection {
  return { name, label: name, user, hidden: 0, items }
}

function railItem(overrides: Partial<NavigationItem>): RailItem {
  return { ...item(overrides), section: 'rail' }
}

describe('flattenRail', () => {
  it('runs several app-level sections into one list, in section order', () => {
    const flattened = flattenRail([
      section('one', [item({ name: 'a' }), item({ name: 'b' })]),
      section('two', [item({ name: 'c' })]),
    ])

    expect(flattened.map((row) => row.name)).toEqual(['a', 'b', 'c'])
  })

  it('keeps the section each item came from', () => {
    const flattened = flattenRail([
      section('one', [item({ name: 'a' })]),
      section('two', [item({ name: 'b' })]),
    ])

    expect(flattened.map((row) => row.section)).toEqual(['one', 'two'])
  })

  it('drops the section labels rather than grouping by them', () => {
    const flattened = flattenRail([section('Sales', [item({})])])
    expect(flattened[0]).not.toHaveProperty('label', 'Sales')
  })

  it('is empty when there are no sections', () => {
    expect(flattenRail([])).toEqual([])
  })

  it('mixes item types in the order they sit in', () => {
    const flattened = flattenRail([
      section('one', [
        item({ name: 'a', type: 'link', dt: '', url: 'https://frappe.io' }),
        item({ name: 'b' }),
        item({ name: 'c', type: 'page', dt: '', url: '/dashboard' }),
      ]),
    ])

    expect(flattened.map((row) => row.type)).toEqual([
      'link',
      'doctype',
      'page',
    ])
  })
})

describe('railDoctypes', () => {
  it('names only the items that carry a doctype', () => {
    const items = [
      railItem({ dt: 'CRM Lead' }),
      railItem({ type: 'link', dt: '', url: 'https://frappe.io' }),
      railItem({ dt: 'CRM Deal' }),
    ]

    expect(railDoctypes(items)).toEqual(['CRM Lead', 'CRM Deal'])
  })
})

describe('isActiveRailItem', () => {
  it('lights a doctype item from the doctype the shell is scoped to', () => {
    const lead = railItem({ dt: 'CRM Lead' })
    expect(isActiveRailItem(lead, 'CRM Lead', '/CRM%20Lead/CRM-LEAD-1')).toBe(
      true,
    )
    expect(isActiveRailItem(lead, 'CRM Deal', '/CRM%20Lead')).toBe(false)
  })

  it('lights a page item from the path it opens', () => {
    const page = railItem({ type: 'page', dt: '', url: '/dashboard' })
    expect(isActiveRailItem(page, '', '/dashboard')).toBe(true)
    expect(isActiveRailItem(page, '', '/reports')).toBe(false)
  })

  it('never lights an item with nowhere to go', () => {
    expect(isActiveRailItem(railItem({ dt: '', url: '' }), '', '')).toBe(false)
  })
})

describe('railHomeRoute', () => {
  it('takes the first item the router can follow', () => {
    expect(railHomeRoute([railItem({ url: '/CRM%20Lead' })])).toBe(
      '/CRM%20Lead',
    )
  })

  it('passes over an item that leaves the app', () => {
    const items = [
      railItem({ type: 'link', dt: '', url: 'https://frappe.io', new_tab: 1 }),
      railItem({ url: '/CRM%20Deal' }),
    ]

    expect(railHomeRoute(items)).toBe('/CRM%20Deal')
  })

  it('answers with nothing for an empty rail', () => {
    expect(railHomeRoute([])).toBe('')
  })
})

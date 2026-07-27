// The rail's list, derived from the app-level navigation sections the CRM app owns.

// The `@framework/ui` barrel re-exports components, and a value import from it would
// pull `.vue` files into a runner that cannot compile them — so a value comes off the
// leaf module and only the types come off the barrel.
import { itemTarget } from '@framework/ui/components/Navigation/items'
import type {
  NavigationItem,
  NavigationSection,
} from '@framework/ui/components/Navigation'

/** One rail tile. It carries the section it came from, which is the handle any write
 *  back to the model needs — the flat list on screen has no other. */
export type RailItem = NavigationItem & { section: string }

/** The rail is free-floating: one ordered list, any item type anywhere. So its
 *  sections are flattened and their labels dropped — a section boundary drawn on a
 *  strip of icons would be chrome nobody could read. */
export function flattenRail(sections: NavigationSection[]): RailItem[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.name })),
  )
}

export function railDoctypes(items: RailItem[]): string[] {
  return items.map((item) => item.dt).filter(Boolean)
}

/** A doctype item goes by the doctype, so every list and record under it keeps the
 *  tile lit; anything else goes by the path it opens, which is the only identity it
 *  has. */
export function isActiveRailItem(
  item: RailItem,
  activeDoctype: string,
  path: string,
): boolean {
  if (item.dt) return item.dt === activeDoctype
  return Boolean(item.url) && item.url === path
}

/** Where "/" lands. An item that leaves the app is passed over — arriving at this
 *  app's home is no reason to be sent off it. */
export function railHomeRoute(items: RailItem[]): string {
  for (const item of items) {
    const target = itemTarget(item)
    if ('path' in target && target.path) return target.path
  }
  return ''
}

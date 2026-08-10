import { itemTarget } from '@framework/ui/experimental/Navigation/items'
import type {
  NavigationItem,
  NavigationSection,
} from '@framework/ui/experimental/Navigation'

export type RailItem = NavigationItem & { section: string }

export function flattenRail(sections: NavigationSection[]): RailItem[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.name })),
  )
}

export function railDoctypes(items: RailItem[]): string[] {
  return items.map((item) => item.dt).filter(Boolean)
}

export function isActiveRailItem(
  item: RailItem,
  activeDoctype: string,
  path: string,
): boolean {
  if (item.dt) return item.dt === activeDoctype
  return Boolean(item.url) && item.url === path
}

export function railHomeRoute(items: RailItem[]): string {
  for (const item of items) {
    const target = itemTarget(item)
    if ('path' in target && target.path) return target.path
  }
  return ''
}

const MAX_ENTRIES = 30

interface Bag {
  path: string
  values: Record<string, unknown>
}

const bags = new Map<string, Bag>()

/** Where a page had got to, held per history entry: how far scrolled, how many rows in. */
export function pageState(): Record<string, unknown> {
  const key = historyKey()
  const path = window.location.pathname
  const existing = bags.get(key)
  // A forward entry that gets overwritten leaves its slot behind for another page.
  if (existing?.path === path) return existing.values

  const bag: Bag = { path, values: {} }
  bags.set(key, bag)
  if (bags.size > MAX_ENTRIES) bags.delete(bags.keys().next().value as string)
  return bag.values
}

export function clearPageState() {
  bags.clear()
}

/** Vue Router numbers the entries it pushes and keeps the number across back and forward. */
function historyKey(): string {
  const state = window.history.state as { position?: number } | null
  return typeof state?.position === 'number' ? `${state.position}` : 'initial'
}

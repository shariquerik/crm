const MAX_ENTRIES = 30

const bags = new Map<string, Record<string, unknown>>()

/** Where a page had got to, held per history entry: how far scrolled, how many rows in. */
export function pageState(): Record<string, unknown> {
  const key = historyKey()
  const existing = bags.get(key)
  if (existing) return existing

  const bag: Record<string, unknown> = {}
  bags.set(key, bag)
  if (bags.size > MAX_ENTRIES) bags.delete(bags.keys().next().value as string)
  return bag
}

export function clearPageState() {
  bags.clear()
}

/** Vue Router stamps every entry it pushes; the first load of a tab has none. */
function historyKey(): string {
  const state = window.history.state as { key?: string } | null
  return state?.key ?? 'initial'
}

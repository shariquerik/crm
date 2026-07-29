const MAX_ENTRIES = 30

interface Bag {
  path: string
  values: Record<string, unknown>
}

const bags = new Map<string, Bag>()

const lastByPath = new Map<string, Record<string, unknown>>()

/** Where a page had got to, held per history entry: how far scrolled, how many rows in. */
export function pageState(): Record<string, unknown> {
  const key = historyKey()
  const path = window.location.pathname
  const existing = bags.get(key)
  // A forward entry that gets overwritten leaves its slot behind for another page.
  if (existing?.path === path) return existing.values

  // A first visit to this entry opens where the path was last left, so returning to a
  // view carries its place even though the navigation is a new entry.
  const values = { ...(lastByPath.get(path) ?? {}) }
  remember(bags, key, { path, values })
  remember(lastByPath, path, values)
  return values
}

export function clearPageState() {
  bags.clear()
  lastByPath.clear()
}

/** Vue Router numbers the entries it pushes and keeps the number across back and forward. */
function historyKey(): string {
  const state = window.history.state as { position?: number } | null
  return typeof state?.position === 'number' ? `${state.position}` : 'initial'
}

function remember<Value>(store: Map<string, Value>, key: string, value: Value) {
  store.delete(key)
  store.set(key, value)
  if (store.size > MAX_ENTRIES)
    store.delete(store.keys().next().value as string)
}

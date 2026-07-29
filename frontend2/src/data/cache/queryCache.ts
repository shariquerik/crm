const MAX_ENTRIES = 20

const MAX_AGE_MS = 5 * 60 * 1000

interface Entry<Value> {
  value: Value
  tag: string
  fetchedAt: number
}

/**
 * What a request last answered, kept under two keys: the request itself, and the route
 * that rendered it. A page knows its route before it knows its query, so the second key
 * is what it repaints from while the first one is still being assembled.
 */
export class QueryCache<Value> {
  private entries = new Map<string, Entry<Value>>()

  private keyByRoute = new Map<string, string>()

  constructor(
    private maxEntries: number = MAX_ENTRIES,
    private maxAge: number = MAX_AGE_MS,
  ) {}

  read(key: string): Value | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.fetchedAt > this.maxAge) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  write(key: string, value: Value, tag: string) {
    this.entries.delete(key)
    this.entries.set(key, { value, tag, fetchedAt: Date.now() })
    if (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value as string)
  }

  /** Points a route at the request it last rendered, so a revisit can find it. */
  remember(route: string, key: string) {
    this.keyByRoute.set(route, key)
  }

  readRoute(route: string): Value | undefined {
    const key = this.keyByRoute.get(route)
    return key ? this.read(key) : undefined
  }

  /** Drops everything a write to `tag` could have changed. */
  invalidate(tag: string) {
    for (const [key, entry] of this.entries)
      if (entry.tag === tag) this.entries.delete(key)
  }

  clear() {
    this.entries.clear()
    this.keyByRoute.clear()
  }
}

export interface ListEntry {
  /** The `get_data` payload, as the server sent it. */
  response: any
  /** The columns that rendered it, so a repaint has headers before the view loads. */
  columns: any[]
}

export const listCache = new QueryCache<ListEntry>()

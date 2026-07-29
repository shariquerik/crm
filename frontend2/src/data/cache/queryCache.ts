const MAX_ENTRIES = 20

const MAX_AGE_MS = 5 * 60 * 1000

interface Entry<Value> {
  value: Value
  tag: string
  fetchedAt: number
}

/** What a request last answered, findable by the request and by the route it rendered. */
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
    return Date.now() - entry.fetchedAt > this.maxAge ? undefined : entry.value
  }

  write(key: string, value: Value, tag: string) {
    this.entries.delete(key)
    this.entries.set(key, { value, tag, fetchedAt: Date.now() })
    if (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value as string)
  }

  /** Points a route at the request it last rendered. */
  remember(route: string, key: string) {
    this.keyByRoute.delete(route)
    this.keyByRoute.set(route, key)
    if (this.keyByRoute.size > this.maxEntries)
      this.keyByRoute.delete(this.keyByRoute.keys().next().value as string)
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

/** The first `pageLength` rows of an answer, which may hold more than this page asks for. */
export function firstRows(response: any, pageLength: number) {
  const rows = response?.data ?? []
  return rows.length > pageLength
    ? { ...response, data: rows.slice(0, pageLength) }
    : response
}

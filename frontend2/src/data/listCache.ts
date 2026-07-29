const MAX_ENTRIES = 20

class BoundedCache<Value> {
  private entries = new Map<string, Value>()

  constructor(private maxEntries: number = MAX_ENTRIES) {}

  get(key: string) {
    return this.entries.get(key)
  }

  set(key: string, value: Value) {
    this.entries.delete(key)
    this.entries.set(key, value)
    if (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value as string)
  }
}

interface ListSnapshot {
  rows: any[]
  columns: any[]
}

export const rowsByQuery = new BoundedCache<unknown>()

export const snapshotByRoute = new BoundedCache<ListSnapshot>()

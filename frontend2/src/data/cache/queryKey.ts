/** How a list request is identified: once for sending it, once for storing its answer. */

/** Identifies a request, so the same one is not sent twice. Column widths do not fetch. */
export function fetchKey(params: Record<string, unknown>) {
  const wire = (params.columns as { width?: unknown }[]) || []
  return stableString({
    ...params,
    columns: wire.map(({ width, ...rest }) => rest),
  })
}

/** Identifies a response. Paging in more rows extends what a query answered, so it keys the same. */
export function cacheKey(params: Record<string, unknown>) {
  const { page_length, ...rest } = params
  return fetchKey(rest)
}

function stableString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableString(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

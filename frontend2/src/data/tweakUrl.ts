import { getFilterableFields } from '@framework/ui/components/Filter'
import { parseOrderBy, serializeOrderBy } from '@framework/ui/components/SortBy'
import { completeFilters, toConditions, toFiltersDict } from '@/data/listWire'

const SORT_KEY = '_sort'
const COLS_KEY = '_cols'

type Query = Record<string, string>

interface TweakState {
  filters?: any[]
  sort?: any[]
  columns?: any[]
}

export function queryFromState(state: TweakState): Query {
  const query: Query = {}
  for (const [fieldname, pair] of Object.entries(
    toFiltersDict(completeFilters(state.filters || [])),
  )) {
    query[fieldname] = toQueryValue(pair)
  }
  const orderBy = serializeOrderBy(state.sort || [])
  if (orderBy) query[SORT_KEY] = orderBy
  const columns = state.columns || []
  if (columns.length) query[COLS_KEY] = JSON.stringify(columns)
  return query
}

export function overridesFromQuery(
  query: Query,
  doctype: string,
  metaFields: any[],
): TweakState {
  const overrides: TweakState = {}
  const filterEntries = Object.entries(query).filter(
    ([key]) => !isReserved(key),
  )
  if (filterEntries.length) {
    overrides.filters = urlConditions(
      doctype,
      metaFields,
      Object.fromEntries(filterEntries),
    )
  }
  if (query[SORT_KEY]) overrides.sort = parseOrderBy(query[SORT_KEY])
  const columns = parseJson(query[COLS_KEY])
  if (Array.isArray(columns)) overrides.columns = columns
  return overrides
}

export function preservedQuery(
  query: Query,
  doctype: string,
  metaFields: any[],
): Query {
  const owned = ownedKeys(doctype, metaFields)
  const kept: Query = {}
  for (const [key, value] of Object.entries(query)) {
    if (!owned.has(key)) kept[key] = String(value)
  }
  return kept
}

export function stableQuery(query: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .map((key) => [key, query[key]]),
  )
}

function ownedKeys(doctype: string, metaFields: any[]): Set<string> {
  const owned = new Set<string>([SORT_KEY, COLS_KEY])
  for (const field of getFilterableFields(metaFields, doctype))
    owned.add(field.fieldname)
  return owned
}

function isReserved(key: string) {
  return key === SORT_KEY || key === COLS_KEY
}

function urlConditions(doctype: string, fields: any[], query: Query) {
  const byName = new Map(
    getFilterableFields(fields, doctype).map((field: any) => [
      field.fieldname,
      field,
    ]),
  )
  const wire: [string, string, unknown][] = []
  for (const [fieldname, raw] of Object.entries(query)) {
    const field = byName.get(fieldname)
    if (field && raw) wire.push([fieldname, ...toWirePair(field, raw)])
  }
  return toConditions(doctype, fields, wire)
}

function toWirePair(field: any, raw: string): [string, unknown] {
  const parsed = parseJson(raw)
  if (
    Array.isArray(parsed) &&
    parsed.length === 2 &&
    typeof parsed[0] === 'string'
  ) {
    return [parsed[0], parsed[1]]
  }
  return ['=', equalsValue(field, raw)]
}

function equalsValue(field: any, raw: string) {
  if (field.fieldtype !== 'Check') return raw
  return ['1', 'true', 'yes'].includes(raw.toLowerCase())
}

function toQueryValue([operator, value]: [string, unknown]) {
  if (operator !== '=') return JSON.stringify([operator, value])
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

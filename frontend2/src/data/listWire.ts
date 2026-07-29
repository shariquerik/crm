import {
  getFilterableFields,
  parseFilters,
  serializeFilters,
} from '@framework/ui/components/Filter'

export function toFiltersDict(conditions: any[]) {
  const dict: Record<string, [string, unknown]> = {}
  for (const [fieldname, operator, value] of serializeFilters(conditions)) {
    dict[fieldname] = [operator, value]
  }
  return dict
}

function isComplete(condition: any) {
  const value = condition?.value
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value) && !value.length) return false
  return true
}

export function completeFilters(conditions: any[]) {
  return (conditions || []).filter(isComplete)
}

export function toConditions(
  doctype: string,
  fields: any[],
  wire: [string, string, unknown][],
) {
  return parseFilters(getFilterableFields(fields, doctype), wire)
    .filter((c: any) => c.operator)
    .map((c: any) => {
      const value = c.value
      const wrapped =
        typeof value === 'string' &&
        c.operator.includes('like') &&
        value.length > 1 &&
        value.startsWith('%') &&
        value.endsWith('%')
      return wrapped ? { ...c, value: value.slice(1, -1) } : c
    })
}

export function fetchKey(params: Record<string, unknown>) {
  const wire = (params.columns as { width?: unknown }[]) || []
  return JSON.stringify({
    ...params,
    columns: wire.map(({ width, ...rest }) => rest),
  })
}

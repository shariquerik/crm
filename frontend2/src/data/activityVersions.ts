/** What one `Version` row says it changed, in the shape `VersionItem` lays out. */
import type { VersionChange } from '@framework/ui/components/ActivityTimeline'

export function versionChanges(
  version: Record<string, any>,
  labels: Record<string, string>,
): VersionChange[] {
  const data = parse(version.data)
  const name = (part: number) => `${version.name}:${part}`
  const label = (fieldname: string) => labels[fieldname] || fieldname

  if (data.comment)
    return [{ type: 'phrase', name: name(0), text: data.comment }]

  return [
    ...submissions(data.changed),
    ...fieldChanges(data.changed, label),
    ...rowChanges(data.row_changed, label),
    ...rowCounts(data.added, label, 'added', 'to'),
    ...rowCounts(data.removed, label, 'removed', 'from'),
  ].map((change, part) => ({ ...change, name: name(part) }) as VersionChange)
}

function parse(data: any): Record<string, any> {
  try {
    return JSON.parse(data) || {}
  } catch {
    return {}
  }
}

const DOCSTATUS = { 1: 'submitted this document', 2: 'cancelled this document' }

function submissions(changed: any[] = []) {
  return changed
    .filter((change) => change[0] === 'docstatus')
    .map((change) => DOCSTATUS[change[2] as 1 | 2])
    .filter(Boolean)
    .map((text) => phrase(text))
}

function fieldChanges(
  changed: any[] = [],
  label: (fieldname: string) => string,
) {
  return changed
    .filter((change) => change[0] !== 'docstatus')
    .map(([fieldname, before, after]) => {
      if (isBlank(after)) return phrase(`cleared ${label(fieldname)}`)
      return {
        type: 'diff' as const,
        name: '',
        fieldname,
        prefix: isBlank(before)
          ? `set ${label(fieldname)} to`
          : `changed ${label(fieldname)}`,
        ...(isBlank(before) ? {} : { from: String(before) }),
        to: String(after),
      }
    })
}

function rowChanges(rows: any[] = [], label: (fieldname: string) => string) {
  const tables = unique(rows.map((row) => label(row[0])))
  return tables.map((table) => phrase(`changed the values in ${table}`))
}

function rowCounts(
  rows: any[] = [],
  label: (fieldname: string) => string,
  verb: string,
  preposition: string,
) {
  return unique(rows.map((row) => row[0])).map((fieldname) => {
    const count = rows.filter((row) => row[0] === fieldname).length
    const noun = count === 1 ? 'row' : 'rows'
    return phrase(`${verb} ${count} ${noun} ${preposition} ${label(fieldname)}`)
  })
}

function phrase(text: string) {
  return { type: 'phrase' as const, name: '', text }
}

function isBlank(value: any) {
  return value === null || value === undefined || value === ''
}

function unique(values: string[]) {
  return [...new Set(values)]
}

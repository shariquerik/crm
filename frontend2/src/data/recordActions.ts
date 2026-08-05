/** What the overflow menu does to a whole record: print it, duplicate it. */

const OWNED_BY_THE_SERVER = [
  'name',
  'owner',
  'creation',
  'modified',
  'modified_by',
  'idx',
  'parent',
  'amended_from',
  '__islocal',
  '__unsaved',
  '_user_tags',
  '_comments',
  '_assign',
  '_liked_by',
]

/** The record as a new one: its values without the identity the server assigns. */
export function duplicatePayload(doc: Record<string, any>) {
  return { ...stripped(doc), docstatus: 0 }
}

function stripped(row: Record<string, any>): Record<string, any> {
  const copy: Record<string, any> = {}
  for (const [key, value] of Object.entries(row)) {
    if (OWNED_BY_THE_SERVER.includes(key)) continue
    copy[key] = isChildTable(value) ? value.map(stripped) : value
  }
  return copy
}

function isChildTable(value: any) {
  return Array.isArray(value) && value.every((row) => row?.doctype)
}

export function printUrl(doctype: string, docname: string) {
  const target = `doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(docname)}`
  return `/printview?${target}&trigger_print=1`
}

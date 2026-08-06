/** The record's document: how `getdoc` answers, and what changed in the answer since. */
// The module, not the barrel: the barrel's `PanelLayout.vue` drags the whole form runtime in.
import { displayValue } from '@framework/ui/components/PanelLayout/displayValue'
import { getFormatDefaults } from '@framework/ui/components/FormLayout/formatDefaults'
import { pickSiblingValue } from '@framework/ui/components/FormLayout/pickSiblingValue'
import type { FieldMeta } from '@framework/ui/components/FormLayout'

export interface RecordPayload {
  doc: Record<string, any>
  docinfo: Record<string, any>
  linkTitles: Record<string, string>
}

/** Names the three buckets `getdoc` answers with. */
// `getdoc` answers on `frappe.response.docs`, not on `message`. The guard is for a cached
// repaint, which runs an already-transformed payload through here again.
export function toRecordPayload(response: any): RecordPayload | undefined {
  if (!response?.docs) return response
  return {
    doc: response.docs[0],
    docinfo: response.docinfo ?? {},
    linkTitles: response._link_titles ?? {},
  }
}

/** What the doctype's meta says to call this record. */
export function recordTitle(
  doc: Record<string, any>,
  meta: Record<string, any> | null,
) {
  return String(doc?.[meta?.title_field] || doc?.name || '')
}

/** The headline the panel shows: what the doctype's meta says to call this record. */
export function recordIdentity(
  doc: Record<string, any>,
  meta: Record<string, any> | null,
  doctypeLabel: string,
) {
  const title = recordTitle(doc, meta)
  return {
    title,
    subtitle: title === doc?.name ? doctypeLabel : String(doc?.name ?? ''),
  }
}

/** The picture the panel offers, why it may not be edited, and the record it comes from. */
export interface RecordImageField {
  fieldname: string
  editable: boolean
  reason: string
  source: { doctype: string; name: string } | null
}

export function recordImageField(
  meta: Record<string, any> | null,
  doc: Record<string, any> = {},
  titleOf: (doctype: string, name: string) => string = (_, name) => name,
): RecordImageField | null {
  const fieldname = meta?.image_field
  if (!fieldname) return null
  const field = docfield(meta, fieldname)
  const source = fetchSource(field, meta, doc)
  const reason = uneditableReason(field, source, titleOf, linkLabel(field, meta))
  return { fieldname, editable: !reason, reason, source }
}

// A `fetch_from` without `fetch_if_empty` is rewritten from its source on every save,
// so an upload here would be thrown away.
function uneditableReason(
  field: Record<string, any> | undefined,
  source: RecordImageField['source'],
  titleOf: (doctype: string, name: string) => string,
  link: string,
) {
  if (!field) return ''
  if (field.read_only) return 'This image is read-only'
  if (!field.fetch_from || field.fetch_if_empty) return ''
  if (!source)
    return link
      ? `This image is fetched from the record linked in ${link}`
      : 'This image is fetched from a linked record'
  const title = titleOf(source.doctype, source.name)
  return `This image comes from ${title}, open it to change`
}

/** What the panel calls the link field the fetch reads through. */
function linkLabel(
  field: Record<string, any> | undefined,
  meta: Record<string, any> | null,
) {
  if (!field?.fetch_from) return ''
  const [linkFieldname] = String(field.fetch_from).split('.')
  const link = docfield(meta, linkFieldname)
  return String(link?.label || linkFieldname || '')
}

/** The record the fetch reads from: whom the link field on this doc points at. */
function fetchSource(
  field: Record<string, any> | undefined,
  meta: Record<string, any> | null,
  doc: Record<string, any>,
) {
  if (!field?.fetch_from) return null
  const [linkFieldname] = String(field.fetch_from).split('.')
  const link = docfield(meta, linkFieldname)
  const name = String(doc?.[linkFieldname] || '')
  if (!link?.options || !name) return null
  return { doctype: String(link.options), name }
}

function docfield(meta: Record<string, any> | null, fieldname: string) {
  const fields: any[] = Array.isArray(meta?.fields) ? meta!.fields : []
  return fields.find((field) => field?.fieldname === fieldname)
}

/** What `current` holds that `stored` does not. */
export function fieldDiff(
  current: Record<string, any>,
  stored: Record<string, any>,
): Record<string, any> {
  const changes: Record<string, any> = {}
  for (const fieldname of fieldsOf(current, stored))
    if (!isSame(current?.[fieldname], stored?.[fieldname]))
      changes[fieldname] = current?.[fieldname]
  return changes
}

/** The fields two diffs off one baseline disagree about. */
export function collidingFields(
  mine: Record<string, any>,
  theirs: Record<string, any>,
): string[] {
  return Object.keys(mine).filter(
    (fieldname) =>
      fieldname in theirs && !isSame(mine[fieldname], theirs[fieldname]),
  )
}

/** One field two people wrote, as the conflict dialog offers it. */
export interface ConflictField {
  fieldname: string
  label: string
  mine: { value: any; display: string }
  theirs: { value: any; display: string }
}

export interface Conflict {
  editor: string
  fields: ConflictField[]
}

/** Which side of each colliding field the user kept. */
export type Choices = Record<string, 'mine' | 'theirs'>

export function conflictRows(
  collisions: string[],
  mine: Record<string, any>,
  theirs: Record<string, any>,
  fields: Record<string, FieldMeta>,
  doc: Record<string, any> = {},
): ConflictField[] {
  return collisions.map((fieldname) => ({
    fieldname,
    label: fields[fieldname]?.label || fieldname,
    mine: side(mine[fieldname], fields[fieldname], doc),
    theirs: side(theirs[fieldname], fields[fieldname], doc),
  }))
}

function side(
  value: any,
  field: FieldMeta | undefined,
  doc: Record<string, any>,
) {
  return { value, display: conflictText(value, field, doc) }
}

// The record's own currency, which a Deal in USD carries against an INR site default.
// The cross-record `doctype:link:field` form needs a fetch, so it takes the default.
function fieldCurrency(field: FieldMeta, doc: Record<string, any>) {
  if (field.fieldtype !== 'Currency' || !field.options) return ''
  if (field.options.includes(':')) return ''
  const sibling = pickSiblingValue({ doc }, field.options)
  return typeof sibling === 'string' ? sibling : ''
}

// A colliding child table is picked whole, so it reads as a row count: `client.save`
// replaces the whole table anyway.
function conflictText(
  value: any,
  field: FieldMeta | undefined,
  doc: Record<string, any>,
) {
  if (Array.isArray(value))
    return `${value.length} ${value.length === 1 ? 'row' : 'rows'}`
  if (!field) return isBlank(value) || value === '' ? 'Empty' : String(value)
  return displayValue(value, field, formatOptions(field, doc)) || 'Empty'
}

function formatOptions(field: FieldMeta, doc: Record<string, any>) {
  const defaults = getFormatDefaults()
  return {
    precision: field.precision,
    currency: fieldCurrency(field, doc) || defaults.currency,
    numberFormat: defaults.number_format,
    roundingMethod: defaults.rounding_method,
  }
}

export function isTimestampMismatch(error: any) {
  return error?.exc_type === 'TimestampMismatchError'
}

function fieldsOf(...documents: Record<string, any>[]) {
  return new Set(documents.flatMap((document) => Object.keys(document || {})))
}

// `getdoc` omits nulls (`as_dict(no_nulls=True)`) and every save endpoint returns them,
// so a missing field and a null one are the same field.
function isSame(value: any, other: any) {
  if (isBlank(value) && isBlank(other)) return true
  return JSON.stringify(value) === JSON.stringify(other)
}

function isBlank(value: any) {
  return value === null || value === undefined
}

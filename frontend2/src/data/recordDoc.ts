/** The record's document: how `getdoc` answers, and what changed in the answer since. */

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

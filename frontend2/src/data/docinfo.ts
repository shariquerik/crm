/** The `docinfo` buckets `getdoc` answers with, and the deltas the socket sends for them. */

export interface Docinfo {
  comments: any[]
  communications: any[]
  versions: any[]
  views: any[]
  shared: any[]
  like_logs: any[]
  workflow_logs: any[]
  assignment_logs: any[]
  attachment_logs: any[]
  info_logs: any[]
  milestones: any[]
  attachments: any[]
  assignments: { name: string; owner: string }[]
  tags: any[]
  user_info: Record<string, { fullname?: string; image?: string }>
  [bucket: string]: any
}

const BUCKETS = [
  'comments',
  'communications',
  'versions',
  'views',
  'shared',
  'like_logs',
  'workflow_logs',
  'assignment_logs',
  'attachment_logs',
  'info_logs',
  'milestones',
  'attachments',
  'assignments',
  'tags',
] as const

/** A record nothing has been said about yet, so every bucket reads as empty. */
export function emptyDocinfo(): Docinfo {
  const empty = Object.fromEntries(BUCKETS.map((bucket) => [bucket, []]))
  return { ...empty, user_info: {} } as Docinfo
}

export interface DocinfoUpdate {
  doc: Record<string, any>
  key: string
  action?: 'add' | 'update' | 'delete'
}

export interface Assignee {
  email: string
  fullName: string
  image: string
}

/** Whether a delta belongs to the record on screen. */
export function isForRecord(
  event: DocinfoUpdate,
  doctype: string,
  docname: string,
) {
  const { reference_doctype, reference_name } = event?.doc ?? {}
  return reference_doctype === doctype && reference_name === docname
}

/** Splices one delta into its own bucket, leaving every other bucket alone. */
export function applyDocinfoUpdate(
  docinfo: Record<string, any>,
  event: DocinfoUpdate,
): Record<string, any> {
  const bucket = docinfo?.[event.key] ?? []
  return { ...docinfo, [event.key]: splice(bucket, event) }
}

function splice(bucket: any[], { doc, action = 'update' }: DocinfoUpdate) {
  if (action === 'add') return [...bucket, doc]
  if (!bucket.some((row) => row.name === doc.name)) return bucket
  if (action === 'delete') return bucket.filter((row) => row.name !== doc.name)
  return bucket.map((row) => (row.name === doc.name ? doc : row))
}

/** Who the record is assigned to, named by `docinfo.user_info`. */
export function assigneesOf(docinfo: Record<string, any>): Assignee[] {
  return (docinfo?.assignments ?? []).map((assignment: any) => ({
    email: assignment.owner,
    fullName: userName(docinfo, assignment.owner),
    image: docinfo?.user_info?.[assignment.owner]?.image || '',
  }))
}

/** What `user_info` calls someone, falling back to the email it knows nothing about. */
export function userName(docinfo: Record<string, any>, email: string) {
  return docinfo?.user_info?.[email]?.fullname || email
}

/** Who a new selection adds and drops against the assignees it replaces. */
export function assignmentDiff(picked: string[], assignees: Assignee[]) {
  const assigned = assignees.map((assignee) => assignee.email)
  return {
    added: picked.filter((email) => !assigned.includes(email)),
    dropped: assigned.filter((email) => !picked.includes(email)),
  }
}

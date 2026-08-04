/** The Activity feed: the `docinfo` buckets and the document's own dates, in one time order. */
import type {
  Activity,
  LogActivity,
  UserInfo,
} from '@framework/ui/components/ActivityTimeline'

import { versionChanges } from '@/data/activityVersions'
import type { Docinfo } from '@/data/docinfo'

type Subtype = LogActivity['data']['subtype']
type Author = (email: string) => UserInfo
type Sentence = (row: any, actor: UserInfo) => string

export function activityFeed(
  doc: Record<string, any>,
  docinfo: Partial<Docinfo>,
  labels: Record<string, string>,
): Activity[] {
  if (!doc?.creation) return []
  const author = (email: string) => authorOf(docinfo, email)
  const logsOf = (bucket: string, subtype: Subtype, sentence: Sentence) =>
    logs(docinfo[bucket], bucket, subtype, author, sentence)

  return [
    ...lifecycle(doc, author),
    ...comments(docinfo.comments, author),
    ...emails(docinfo.communications, author),
    ...versions(docinfo.versions, labels, author),
    ...attachmentLogs(docinfo.attachment_logs, author),
    ...assignmentLogs(docinfo.assignment_logs, author),
    ...logsOf('views', 'view', (row, actor) => `${actor.fullname} viewed this`),
    ...logsOf('like_logs', 'like', (row, actor) => `${actor.fullname} liked`),
    ...logsOf('workflow_logs', 'workflow', contentOf),
    ...logsOf('info_logs', 'info', contentOf),
    ...logsOf(
      'shared',
      'info',
      (row, actor) =>
        `${actor.fullname} shared this with ${row.user || 'everyone'}`,
    ),
    ...logsOf(
      'milestones',
      'info',
      (row, actor) =>
        `${actor.fullname} changed ${labels[row.track_field] || row.track_field} to ${row.value}`,
    ),
  ].sort((one, other) =>
    String(one.timestamp).localeCompare(String(other.timestamp)),
  )
}

/** Who `user_info` says an actor is, falling back to the email it knows nothing about. */
function authorOf(docinfo: Partial<Docinfo>, email: string): UserInfo {
  const user = docinfo?.user_info?.[email]
  return { email, fullname: user?.fullname || email, image: user?.image || '' }
}

function lifecycle(doc: Record<string, any>, author: Author): Activity[] {
  const creator = author(doc.owner)
  const created = log(
    'log:created',
    doc.creation,
    creator,
    'created',
    `${creator.fullname} created this`,
  )
  if (!doc.modified || doc.modified === doc.creation) return [created]

  const editor = author(doc.modified_by)
  return [
    created,
    log(
      'log:edited',
      doc.modified,
      editor,
      'info',
      `${editor.fullname} last edited this`,
    ),
  ]
}

function comments(rows: any[] = [], author: Author): Activity[] {
  return rows.map((row) => ({
    type: 'comment',
    key: `comment:${row.name}`,
    timestamp: row.creation,
    author: author(row.comment_email || row.owner),
    data: { name: row.name, content: row.content },
  }))
}

function emails(rows: any[] = [], author: Author): Activity[] {
  return rows.map((row) => ({
    type: 'email',
    key: `email:${row.name}`,
    timestamp: row.communication_date || row.creation,
    author: author(row.sender),
    data: {
      name: row.name,
      subject: row.subject,
      sender: row.sender,
      to: row.recipients,
      cc: row.cc,
      bcc: row.bcc,
      content: row.content,
      deliveryStatus: row.delivery_status,
      attachments: parseAttachments(row.attachments),
    },
  }))
}

// `getdoc` hands an email's attached files back as a JSON string, not a list.
function parseAttachments(attachments: any) {
  if (Array.isArray(attachments)) return attachments
  try {
    return JSON.parse(attachments || '[]')
  } catch {
    return []
  }
}

function versions(
  rows: any[] = [],
  labels: Record<string, string>,
  author: Author,
): Activity[] {
  return rows.flatMap((row) => {
    const changes = versionChanges(row, labels)
    if (!changes.length) return []
    const group = changes.length > 1 ? { group: changes } : {}
    return [
      {
        type: 'version' as const,
        key: `version:${row.name}`,
        timestamp: row.creation,
        author: author(row.owner),
        data: { ...changes[0], ...group },
      },
    ]
  })
}

function attachmentLogs(rows: any[] = [], author: Author): Activity[] {
  return rows.map((row) => {
    const removed = row.comment_type === 'Attachment Removed'
    const fileUrl = removed ? undefined : linkHref(row.content)
    return {
      type: 'attachment_log',
      key: `attachment:${row.name}`,
      timestamp: row.creation,
      author: author(row.owner),
      data: {
        name: row.name,
        action: removed ? 'removed' : 'added',
        fileName: stripHtml(row.content),
        isPrivate: fileUrl?.startsWith('/private/') ?? false,
        ...(fileUrl ? { fileUrl } : {}),
      },
    }
  })
}

function assignmentLogs(rows: any[] = [], author: Author): Activity[] {
  const subtype = (row: any): Subtype =>
    row.comment_type === 'Assignment Completed'
      ? 'assignment_completed'
      : 'assigned'
  return rows.map((row) =>
    log(
      `log:assignment:${row.name}`,
      row.creation,
      author(row.owner),
      subtype(row),
      stripHtml(row.content),
    ),
  )
}

function logs(
  rows: any[] = [],
  bucket: string,
  subtype: Subtype,
  author: Author,
  sentence: Sentence,
): Activity[] {
  return rows.map((row, index) => {
    const actor = author(row.owner)
    return log(
      `log:${bucket}:${row.name ?? index}`,
      row.creation,
      actor,
      subtype,
      sentence(row, actor),
    )
  })
}

// `text` carries the actor's name because `LogItem` bolds by matching it in the sentence.
function log(
  key: string,
  timestamp: string,
  author: UserInfo,
  subtype: Subtype,
  text: string,
): LogActivity {
  return {
    type: 'log',
    key,
    timestamp,
    author,
    data: { name: key, subtype, text },
  }
}

function contentOf(row: any) {
  return stripHtml(row.content)
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').trim()
}

function linkHref(content = '') {
  return content.match(/href=['"]([^'"]+)['"]/)?.[1]
}

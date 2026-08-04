/** The composer's draft, and what each of its two send calls carries. */

import type {
  CommentPayload,
  EmailPayload,
  Recipient,
  Recipients,
  UploadedFile,
} from '@framework/ui/components/Composer'
import type { FormLayoutSchema } from '@framework/ui/components/FormLayout'

export type ComposerMode = 'reply' | 'comment'

export type Draft = {
  open: boolean
  mode: ComposerMode
  body: string
  subject: string
  recipients: Recipients
}

/** What a reply is prefilled from. */
export type ComposerRecord = {
  docname: string
  doc: Record<string, any>
  layout: FormLayoutSchema
}

export type Sender = { email: string; fullName: string }

/** Where a drag started: the card's height then, and the pointer's y. */
export type ResizeStart = { height: number; y: number }

export const DEFAULT_COMPOSER_HEIGHT = 320
const MIN_COMPOSER_HEIGHT = 180
const MAX_COMPOSER_VIEWPORT_RATIO = 0.72

/** Dragging the handle up grows the card, down shrinks it. */
export function resizedHeight(
  start: ResizeStart,
  pointerY: number,
  viewportHeight: number,
) {
  return clampHeight(start.height + start.y - pointerY, viewportHeight)
}

export function clampHeight(height: number, viewportHeight: number) {
  const ceiling = Math.floor(viewportHeight * MAX_COMPOSER_VIEWPORT_RATIO)
  return Math.min(
    Math.max(height, MIN_COMPOSER_HEIGHT),
    Math.max(ceiling, MIN_COMPOSER_HEIGHT),
  )
}

export function emptyDraft(): Draft {
  return {
    open: false,
    mode: 'comment',
    body: '',
    subject: '',
    recipients: { to: [], cc: [], bcc: [] },
  }
}

/** Opening keeps a draft that has content, whichever control opened it. */
export function openDraft(
  draft: Draft,
  mode: ComposerMode,
  record: ComposerRecord,
): Draft {
  const body = hasContent(draft) ? draft.body : ''
  if (mode === 'comment') return { ...emptyDraft(), open: true, mode, body }
  return { ...replyEnvelope(draft, record), open: true, mode, body }
}

/** A reply keeps an envelope it already has; otherwise the record fills one. */
function replyEnvelope(draft: Draft, record: ComposerRecord): Draft {
  if (draft.mode === 'reply' && draft.subject) return draft
  const email = recordEmail(record)
  return {
    ...emptyDraft(),
    subject: `Re: ${record.docname}`,
    recipients: { to: email ? [{ email }] : [], cc: [], bcc: [] },
  }
}

function hasContent(draft: Draft) {
  return draft.body.replace(/<[^>]*>/g, '').trim().length > 0
}

/** `crm.api.comment.add_comment`, which links the attachments to the Comment it makes. */
export function commentArgs(
  doctype: string,
  docname: string,
  payload: CommentPayload,
) {
  return {
    reference_doctype: doctype,
    reference_name: docname,
    content: payload.body,
    attachments: fileNames(payload.attachments),
  }
}

/** `frappe.core.doctype.communication.email.make`, whose address lists are strings. */
export function emailArgs(
  doctype: string,
  docname: string,
  sender: Sender,
  payload: EmailPayload,
) {
  return {
    doctype,
    name: docname,
    content: payload.body,
    subject: payload.subject,
    send_email: 1,
    sender: sender.email,
    sender_full_name: sender.fullName || undefined,
    recipients: addresses(payload.recipients.to),
    cc: addresses(payload.recipients.cc),
    bcc: addresses(payload.recipients.bcc),
    attachments: fileNames(payload.attachments),
  }
}

/** The first address the record carries, as its `Data`/`Email` fields declare them. */
export function recordEmail({ doc, layout }: ComposerRecord) {
  for (const field of emailFields(layout)) {
    const value = doc?.[field.fieldname]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function emailFields(layout: FormLayoutSchema) {
  return (layout ?? [])
    .flatMap((tab) => tab.sections ?? [])
    .flatMap((section) => section.columns ?? [])
    .flatMap((column) => column.fields ?? [])
    .filter((field) => field.fieldtype === 'Data' && field.options === 'Email')
}

function addresses(recipients: Recipient[]) {
  return recipients.map(({ email }) => email).join(', ')
}

function fileNames(attachments: UploadedFile[]) {
  return attachments.map(({ name }) => name)
}

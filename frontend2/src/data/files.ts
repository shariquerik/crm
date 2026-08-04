/** The record's attachments, as the Files feed reads them. */

import type { CustomActivity } from '@framework/ui/components/ActivityTimeline'

import { userName } from '@/data/docinfo'

export interface FileRow {
  name: string
  file_name: string
  file_url: string
  is_private: 0 | 1
  creation: string
  owner: string
}

// `docinfo.attachments` carries none of the last three, and the feed shows all of them.
export const FILE_FIELDS = [
  'name',
  'file_name',
  'file_url',
  'is_private',
  'creation',
  'owner',
]

/** Attachment rows as timeline entries, oldest first. */
export function toFileActivities(
  rows: FileRow[] | null | undefined,
  docinfo: Record<string, any>,
): CustomActivity[] {
  return [...(rows ?? [])].reverse().map((row) => toFileActivity(row, docinfo))
}

function toFileActivity(
  row: FileRow,
  docinfo: Record<string, any>,
): CustomActivity {
  return {
    type: 'file',
    key: `file:${row.name}`,
    timestamp: row.creation,
    icon: 'paperclip',
    author: { email: row.owner, fullname: userName(docinfo, row.owner) },
    data: row,
  }
}

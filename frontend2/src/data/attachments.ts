/** Uploads that land on the record, so the Files tab lists them. */

import { useFileUpload } from 'frappe-ui'
import type { UploadTransport } from '@framework/ui/components/FileUpload'

// The framework's default transport attaches to nothing, and only `upload_file`'s
// doctype/docname pair files the File against the record.
export function recordTransport(
  doctype: string,
  docname: string,
): UploadTransport {
  return async (file, args, ctx) => {
    const { upload } = useFileUpload()
    const uploaded = await upload(file, {
      doctype,
      docname,
      private: args.isPrivate,
      optimize: args.optimize,
      signal: ctx.signal,
      onProgress: ({ loaded, total }) => ctx.onProgress(loaded, total),
    })
    return { file_url: uploaded.file_url }
  }
}

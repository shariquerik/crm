import { createResource } from 'frappe-ui'

import { toFieldsLayout } from '@/data/fieldsLayout'
import { FILE_FIELDS } from '@/data/files'
import { toRecordPayload } from '@/data/recordDoc'

const FIELDS_LAYOUT_URL =
  'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout'

export function listResources(doctype: string) {
  return {
    listData: createResource({
      url: 'crm.api.doc.get_data',
      method: 'POST',
      params: {
        doctype,
        filters: {},
        order_by: 'modified desc',
        page_length: 20,
        page_length_count: 20,
      },
    }),
    createLayout: createResource({
      url: FIELDS_LAYOUT_URL,
      method: 'GET',
      params: { doctype, type: 'Quick Entry' },
      transform: toFieldsLayout,
    }),
  }
}

export function recordResources(doctype: string, id: string) {
  return {
    docResource: createResource({
      url: 'frappe.desk.form.load.getdoc',
      method: 'GET',
      params: { doctype, name: id },
      transform: toRecordPayload,
    }),
    fieldsLayout: createResource({
      url: FIELDS_LAYOUT_URL,
      method: 'GET',
      params: { doctype, type: 'Data Fields' },
      transform: toFieldsLayout,
    }),
    files: filesQuery(doctype, id),
  }
}

// createListResource cannot ask for every row — it reads `pageLength: 0` as its default
// of 20 — and the feed has no pager to reach what a limit would leave behind.
function filesQuery(doctype: string, id: string) {
  return createResource({
    url: 'frappe.client.get_list',
    method: 'GET',
    auto: false,
    params: {
      doctype: 'File',
      fields: FILE_FIELDS,
      filters: { attached_to_doctype: doctype, attached_to_name: id },
      order_by: 'creation desc',
      limit_page_length: 0,
    },
  })
}

import { createResource } from 'frappe-ui'

import { toFieldsLayout } from '@/data/fieldsLayout'

const FIELDS_LAYOUT_URL =
  'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout'

export function resolveDoctype(doctype: string) {
  return createResource({
    url: 'crm.api.doc.resolve_doctype',
    method: 'GET',
    params: { doctype },
    auto: true,
    cache: ['routeDoctype', doctype],
  })
}

export function listResources(doctype: string) {
  return {
    routeDoctype: resolveDoctype(doctype),
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

export function detailResources(doctype: string, id: string) {
  const reference = {
    reference_doctype: doctype,
    reference_docname: id,
  }
  return {
    routeDoctype: resolveDoctype(doctype),
    record: createResource({
      url: 'frappe.client.get',
      method: 'GET',
      params: { doctype, name: id },
    }),
    fieldsLayout: createResource({
      url: FIELDS_LAYOUT_URL,
      method: 'GET',
      params: { doctype, type: 'Data Fields' },
      transform: toFieldsLayout,
    }),
    notes: createResource({
      url: 'frappe.client.get_list',
      method: 'POST',
      params: {
        doctype: 'FCRM Note',
        fields: ['name', 'title', 'content', 'modified'],
        filters: reference,
        order_by: 'creation desc',
        limit_page_length: 50,
      },
      transform: toNotePreviews,
    }),
    tasks: createResource({
      url: 'frappe.client.get_list',
      method: 'POST',
      params: {
        doctype: 'CRM Task',
        fields: ['name', 'title', 'status', 'priority', 'due_date'],
        filters: reference,
        order_by: 'creation desc',
        limit_page_length: 50,
      },
    }),
  }
}

function toNotePreviews(notes: any[]) {
  return (notes || []).map((note) => ({
    ...note,
    preview: plainText(note.content || ''),
  }))
}

function plainText(html: string) {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  return (body.textContent || '').replace(/\s+/g, ' ').trim()
}

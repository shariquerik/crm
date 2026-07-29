import { createResource } from 'frappe-ui'

import { toFieldsLayout } from '@/data/fieldsLayout'

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

export function detailResources(doctype: string, id: string) {
  return {
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
  }
}

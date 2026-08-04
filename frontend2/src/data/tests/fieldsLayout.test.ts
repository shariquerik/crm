import { describe, expect, it } from 'vitest'

import { fieldLabels, toFieldsLayout } from '@/data/fieldsLayout'

const layout = toFieldsLayout([
  {
    name: 'tab1',
    label: 'Details',
    sections: [
      {
        name: 'section1',
        columns: [
          {
            name: 'column1',
            fields: [
              { fieldname: 'status', fieldtype: 'Select', label: 'Status' },
              { fieldname: 'notes', fieldtype: 'Small Text', label: '' },
            ],
          },
        ],
      },
    ],
  },
])

describe('fieldLabels', () => {
  it('names every field the layout carries', () => {
    expect(fieldLabels(layout)).toEqual({ status: 'Status' })
  })

  it('reads an absent layout as naming nothing', () => {
    expect(fieldLabels(undefined)).toEqual({})
  })
})

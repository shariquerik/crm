const LAYOUT_BREAKS = ['Tab Break', 'Section Break', 'Column Break']
// get_fields_layout carries no child-table meta, so a grid would render column-less.
// Child tables are out of scope for v1's form.
const CHILD_TABLES = ['Table', 'Table MultiSelect']

export function toFieldsLayout(tabs: any[]) {
  return (tabs || []).map((tab) => ({
    name: tab.name,
    label: tab.label,
    sections: (tab.sections || []).map(toSection),
  }))
}

/** What the layout calls each of its fields, for anything rendering a fieldname. */
export function fieldLabels(tabs: any[] = []): Record<string, string> {
  const fields = (tabs || []).flatMap((tab: any) =>
    (tab.sections || []).flatMap((section: any) =>
      (section.columns || []).flatMap((column: any) => column.fields || []),
    ),
  )
  return Object.fromEntries(
    fields
      .filter((field: any) => field.label)
      .map((field: any) => [field.fieldname, field.label]),
  )
}

function toSection(section: any) {
  return {
    name: section.name,
    label: section.label,
    hideLabel: Boolean(section.hideLabel),
    hideBorder: Boolean(section.hideBorder),
    collapsible: Boolean(section.collapsible),
    opened: section.opened !== false,
    columns: (section.columns || []).map(toColumn),
  }
}

function toColumn(column: any) {
  return {
    name: column.name,
    fields: (column.fields || [])
      // a fieldname the doctype no longer has stays an unexpanded string
      .filter((field: any) => field && typeof field === 'object')
      .filter(
        (field: any) =>
          !LAYOUT_BREAKS.includes(field.fieldtype) &&
          !CHILD_TABLES.includes(field.fieldtype),
      )
      .map(toFieldMeta),
  }
}

function toFieldMeta(field: any) {
  return {
    fieldname: field.fieldname,
    fieldtype: field.fieldtype,
    label: field.label,
    options: toOptions(field.options),
    reqd: Boolean(field.reqd),
    hidden: Boolean(field.hidden),
    readOnly: Boolean(field.read_only) || field.fieldtype === 'Read Only',
    precision: field.precision ? Number(field.precision) : undefined,
    description: field.description || undefined,
    placeholder: field.placeholder || undefined,
    dependsOn: field.depends_on || undefined,
    mandatoryDependsOn: field.mandatory_depends_on || undefined,
    readOnlyDependsOn: field.read_only_depends_on || undefined,
  }
}

// Select options are a newline-joined string in meta; CRM hands some layouts
// back as [{label, value}] instead.
function toOptions(options: any) {
  if (!Array.isArray(options)) return options
  return options
    .map((option) =>
      option && option.value !== undefined ? option.value : option,
    )
    .join('\n')
}

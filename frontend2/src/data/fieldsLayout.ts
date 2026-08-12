/** Every field the layout carries, by fieldname. */
export function fieldMetaByName(layout: any[]) {
  const fields: Record<string, any> = {}
  for (const tab of layout || [])
    for (const section of tab.sections || [])
      for (const column of section.columns || [])
        for (const field of column.fields || []) fields[field.fieldname] = field
  return fields
}

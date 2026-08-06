/** The record's picture: what it shows, whether it may be edited, and where it comes from. */
import { computed, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDoctypeMeta } from '@framework/ui'

import { linkTitle } from '@/data/linkTitles'
import { recordImageField } from '@/data/recordDoc'

export function useRecordImage(
  doctype: () => string,
  doc: Ref<Record<string, any>>,
) {
  const router = useRouter()
  const { meta } = useDoctypeMeta(doctype)

  const field = computed(() =>
    recordImageField(meta.value, doc.value, linkTitle),
  )

  const image = computed(() =>
    field.value ? String(doc.value?.[field.value.fieldname] || '') : '',
  )

  /** A fetched picture is changed on its own record, which opens in a tab of its own. */
  const sourceHref = computed(() => {
    const source = field.value?.source
    if (!source || field.value?.editable) return ''
    return router.resolve({
      name: 'Record',
      params: { doctype: source.doctype, id: source.name },
    }).href
  })

  // An upload lands in the doc like any other edit, and saves with it.
  function setImage(url: string) {
    if (field.value?.editable)
      doc.value = { ...doc.value, [field.value.fieldname]: url }
  }

  return { field, image, sourceHref, setImage }
}

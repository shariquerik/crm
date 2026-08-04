import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { call, toast } from 'frappe-ui'
import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@/data/apps'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { errorMessage } from '@/data/errors'
import { doctypeChanged } from '@/data/doctypeChanged'
import { fetchCached } from '@/data/cache/queryCache'
import {
  collidingFields,
  fieldDiff,
  isTimestampMismatch,
} from '@/data/recordDoc'

const FIELDS_LAYOUT_TAG = 'CRM Fields Layout'

export function useRecordPage(resources: any) {
  const { docResource, fieldsLayout } = resources
  const route = useRoute()

  const doc = ref<Record<string, any>>({})
  /** The document as the server last showed it. */
  const stored = ref<Record<string, any>>({})
  const linkTitles = ref<Record<string, string>>({})
  const saving = ref(false)
  const saveError = ref('')

  const doctype = computed(() => route.params.doctype as string)
  const doctypeLink = computed(() => `/${encodeURIComponent(doctype.value)}`)

  const viewId = typeof route.query.view === 'string' ? route.query.view : ''
  const viewLink = computed(() =>
    viewId ? `${doctypeLink.value}/view/${encodeURIComponent(viewId)}` : '',
  )
  const navigation = viewId
    ? useNavigation(doctype.value, viewId, { app: APP_NAME })
    : null

  if (routeDoctype(doctype.value) !== null) {
    const name = doctype.value
    fetchCached(docResource, `record:${name}/${route.params.id}`, name)
    fetchCached(fieldsLayout, `layout:${name}`, FIELDS_LAYOUT_TAG)
  }

  function changedFields() {
    return fieldDiff(doc.value, stored.value)
  }

  const isDirty = computed(() => Object.keys(changedFields()).length > 0)

  let lastPainted: any = null

  function paint(payload: any) {
    lastPainted = payload
    stored.value = { ...(payload?.doc ?? {}) }
    doc.value = { ...stored.value }
    linkTitles.value = payload?.linkTitles ?? {}
    saveError.value = ''
  }

  // The cached record paints first and the fetched one lands behind it; typing in that
  // window is the reader's, not a stale copy to overwrite.
  watch(
    () => docResource.data,
    (payload: any) => {
      if (payload === lastPainted) return
      if (!saving.value && isDirty.value) return
      paint(payload)
    },
    { immediate: true },
  )

  const viewCrumb = computed(() => {
    const view = navigation?.activeView.value
    return view?.label
      ? { label: view.label, icon: view.icon, route: viewLink.value }
      : null
  })

  const breadcrumbs = computed(() =>
    [
      {
        label: doctypeLabel(doctype.value),
        route: doctypeLink.value,
      },
      viewCrumb.value,
      { label: doc.value?.name || route.params.id },
    ].filter(Boolean),
  )

  async function save() {
    if (saving.value) return
    if (!isDirty.value) return toast('No changes to save')

    saving.value = true
    saveError.value = ''
    try {
      await saveOrRecover()
    } catch (error: any) {
      saveError.value = errorMessage(error)
      toast.error(saveError.value)
    } finally {
      saving.value = false
    }
  }

  async function saveOrRecover() {
    try {
      await send()
      toast.success('Saved')
    } catch (error: any) {
      if (!isTimestampMismatch(error)) throw error
      await recover()
    }
  }

  // The payload is the whole document: a trimmed one nulls a field it leaves out and
  // empties a child table.
  async function send() {
    paintSaved(await call('frappe.client.save', { doc: doc.value }))
  }

  /** Recovers from a concurrent edit by three-way merge. */
  async function recover() {
    const mine = changedFields()
    const baseline = stored.value
    await docResource.reload()
    paint(docResource.data)
    const editor = editorName()

    const collisions = collidingFields(mine, fieldDiff(stored.value, baseline))
    reapply(mine, collisions)
    if (collisions.length) throw new Error(collisionMessage(editor))

    await retry()
    toast.success(
      `Saved. ${editor} also edited this record while you were working.`,
    )
  }

  /** One retry, so a record that moves twice reports rather than loops. */
  async function retry() {
    try {
      await send()
    } catch (error: any) {
      if (!isTimestampMismatch(error)) throw error
      throw new Error(
        'The record changed again while it was saving. Your edits are kept — save again to try once more.',
      )
    }
  }

  function reapply(mine: Record<string, any>, collisions: string[]) {
    for (const [fieldname, value] of Object.entries(mine))
      if (!collisions.includes(fieldname)) doc.value[fieldname] = value
  }

  function collisionMessage(editor: string) {
    return `${editor} changed the same fields while you were working, so their values are showing. Your other edits are kept — check them and save again.`
  }

  /** Who last wrote the record, named by `docinfo.user_info`. */
  function editorName() {
    const user = stored.value.modified_by
    const info = docResource.data?.docinfo?.user_info?.[user]
    return info?.fullname || user || 'Someone else'
  }

  /** Takes the save response as the new baseline. */
  function paintSaved(saved: Record<string, any>) {
    stored.value = { ...saved }
    doc.value = { ...saved }
    doctypeChanged(doctype.value)
  }

  return {
    doc,
    isDirty,
    changedFields,
    linkTitles,
    saving,
    saveError,

    breadcrumbs,
    save,
  }
}

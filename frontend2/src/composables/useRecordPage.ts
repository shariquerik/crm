import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { call, toast } from 'frappe-ui'
import { useDoctypeMeta } from '@framework/ui'
import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@/data/apps'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { errorMessage } from '@/data/errors'
import { doctypeChanged } from '@/data/doctypeChanged'
import { fetchCached, refetchCached } from '@/data/cache/queryCache'
import { useDocinfo } from '@/composables/useDocinfo'
import { userName } from '@/data/docinfo'
import { fieldMetaByName } from '@/data/fieldsLayout'
import { rememberLinkTitles } from '@/data/linkTitles'
import {
  collidingFields,
  conflictRows,
  fieldDiff,
  isTimestampMismatch,
  recordTitle,
  type Choices,
  type Conflict,
} from '@/data/recordDoc'

const FIELDS_LAYOUT_TAG = 'CRM Fields Layout'
const MOVED_TWICE =
  'The record changed again while it was saving. Your edits are kept — save again to try once more.'

export function useRecordPage(resources: any) {
  const { docResource, fieldsLayout, files } = resources
  const route = useRoute()

  const doc = ref<Record<string, any>>({})
  /** The document as the server last showed it. */
  const stored = ref<Record<string, any>>({})
  const saving = ref(false)
  const saveError = ref('')
  const conflict = ref<Conflict | null>(null)
  const conflictVisible = ref(false)

  const doctype = computed(() => route.params.doctype as string)
  const docname = route.params.id as string
  const doctypeLink = computed(() => `/${encodeURIComponent(doctype.value)}`)
  const { meta } = useDoctypeMeta(doctype)

  const recordKey = `record:${doctype.value}/${docname}`

  const docinfo = useDocinfo(docResource, {
    doctype: doctype.value,
    docname,
    refetch: () => refetchCached(docResource, recordKey, doctype.value),
    reloadFiles: () => {
      if (files.data) files.reload()
    },
  })

  const viewId = typeof route.query.view === 'string' ? route.query.view : ''
  const viewLink = computed(() =>
    viewId ? `${doctypeLink.value}/view/${encodeURIComponent(viewId)}` : '',
  )
  const navigation = viewId
    ? useNavigation(doctype.value, viewId, { app: APP_NAME })
    : null

  if (routeDoctype(doctype.value) !== null) {
    const name = doctype.value
    fetchCached(docResource, recordKey, name)
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
    rememberLinkTitles(payload?.linkTitles ?? {})
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
      { label: recordTitle(doc.value, meta.value) || docname },
    ].filter(Boolean),
  )

  async function save() {
    if (saving.value) return
    // Nothing was resolved, so the same decision blocks this save too.
    if (conflict.value) {
      conflictVisible.value = true
      return
    }
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
      await recover(true)
    }
  }

  // The payload is the whole document: a trimmed one nulls a field it leaves out and
  // empties a child table.
  async function send() {
    paintSaved(await call('frappe.client.save', { doc: doc.value }))
  }

  /** Recovers from a concurrent edit by three-way merge, retrying at most once. */
  async function recover(mayRetry: boolean) {
    const mine = changedFields()
    const baseline = stored.value
    await docResource.reload()
    paint(docResource.data)
    const editor = editorName()

    const collisions = collidingFields(mine, fieldDiff(stored.value, baseline))
    reapply(mine, collisions)
    if (collisions.length) return openConflict(editor, mine, collisions)
    if (!mayRetry) throw new Error(MOVED_TWICE)

    try {
      await send()
    } catch (error: any) {
      if (!isTimestampMismatch(error)) throw error
      return recover(false)
    }
    toast.success(
      `Saved. ${editor} also edited this record while you were working.`,
    )
  }

  function reapply(mine: Record<string, any>, collisions: string[]) {
    for (const [fieldname, value] of Object.entries(mine))
      if (!collisions.includes(fieldname)) doc.value[fieldname] = value
  }

  /** The colliding fields hold theirs until the user says otherwise. */
  function openConflict(
    editor: string,
    mine: Record<string, any>,
    collisions: string[],
  ) {
    conflict.value = {
      editor,
      fields: conflictRows(
        collisions,
        mine,
        stored.value,
        fieldMetaByName(fieldsLayout.data || []),
        stored.value,
      ),
    }
    conflictVisible.value = true
  }

  /** The dialog answers for every colliding field, whatever the doc holds by now. */
  async function resolveConflict(choices: Choices) {
    const fields = conflict.value?.fields ?? []
    closeConflict()
    for (const field of fields)
      doc.value[field.fieldname] =
        choices[field.fieldname] === 'mine'
          ? field.mine.value
          : field.theirs.value
    await save()
  }

  function discardConflict() {
    doc.value = { ...stored.value }
    closeConflict()
  }

  function closeConflict() {
    conflict.value = null
    conflictVisible.value = false
  }

  /** Who last wrote the record, named by `docinfo.user_info`. */
  function editorName() {
    const user = stored.value.modified_by
    if (!user) return 'Someone else'
    return userName(docinfo.docinfo.value, user)
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
    feeds: { files },
    saving,
    saveError,
    conflict,
    conflictVisible,
    resolveConflict,
    discardConflict,

    breadcrumbs,
    save,
    ...docinfo,
  }
}

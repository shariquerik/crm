import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { call, toast } from 'frappe-ui'
import { useDoctypeMeta } from '@framework/ui'
import {
  createRecordPage,
  useFormLayout,
  useNavigation,
  usePageScripts,
} from '@framework/ui/experimental'
import { APP_NAME } from '@/data/apps'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { errorMessage } from '@/data/errors'
import { doctypeChanged } from '@/data/doctypeChanged'
import { fetchCached, refetchCached } from '@/data/cache/queryCache'
import { useDocinfo } from '@/composables/useDocinfo'
import { userName } from '@/data/docinfo'
import { fieldMetaByName } from '@/data/fieldsLayout'
import { rememberLinkTitles } from '@/data/linkTitles'
import { activeTab } from '@/data/recordLayout'
import {
  childRowEvents,
  collidingFields,
  conflictRows,
  fieldDiff,
  isTimestampMismatch,
  recordTitle,
  type Choices,
  type Conflict,
} from '@/data/recordDoc'

const MOVED_TWICE =
  'The record changed again while it was saving. Your edits are kept — save again to try once more.'

export function useRecordPage(resources: any) {
  const { docResource, files } = resources
  const route = useRoute()
  const router = useRouter()

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
  // Conditions read the saved doc, not the draft: a layout that flipped on the
  // keystroke that satisfied it would remount the form and steal focus.
  const { layout } = useFormLayout({
    doctype: doctype.value,
    type: 'Details',
    doc: stored,
  })
  const panelSource = useFormLayout({
    doctype: doctype.value,
    type: 'Side Panel',
    doc: stored,
    fallback: 'none',
  })
  const panelLayout = computed(() =>
    panelSource.layout.value.length ? panelSource.layout.value : layout.value,
  )

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
    fetchCached(docResource, recordKey, doctype.value)
  }

  function changedFields() {
    return fieldDiff(doc.value, stored.value)
  }

  const isDirty = computed(() => Object.keys(changedFields()).length > 0)

  const pageScripts = usePageScripts(doctype.value, {
    onChange: () => pageController.refresh(),
  })

  const pageController = createRecordPage({
    doctype: doctype.value,
    docname,
    doc,
    meta,
    perms: () => docResource.data?.docinfo?.permissions ?? {},
    isDirty: () => isDirty.value,
    activeTab: () =>
      activeTab(
        pageController.tabs.visible(),
        route.query.tab as string | undefined,
      )?.name ?? '',
    save: () => save(),
    reload: async () => {
      await refetchCached(docResource, recordKey, doctype.value)
    },
    router,
    sourcesReady: () => pageScripts.ready,
  })

  let lastPainted: any = null
  let painted = false

  function paint(payload: any) {
    lastPainted = payload
    stored.value = { ...(payload?.doc ?? {}) }
    // Deep clone: a shared child-table array would let an in-place row push
    // mutate the baseline too, hiding the edit from isDirty.
    doc.value = JSON.parse(JSON.stringify(stored.value))
    rememberLinkTitles(payload?.linkTitles ?? {})
    saveError.value = ''
    painted = true
    pageController.refresh()
  }

  // Scripts' `<fieldname>` handlers fire on edits, not on paints: a paint only
  // resyncs the snapshot the next edit diffs against.
  let fieldSnapshot: Record<string, any> = {}

  watch(
    doc,
    () => {
      const previous = fieldSnapshot
      const changed = Object.keys(fieldDiff(doc.value, previous))
      // A deep clone: a row pushed into a shared child-table array must still diff.
      fieldSnapshot = JSON.parse(JSON.stringify(doc.value))
      if (painted) return (painted = false)
      for (const fieldname of changed) pageController.fireEvent(fieldname)
      for (const event of childRowEvents(changed, doc.value, previous))
        pageController.fireEvent(event)
    },
    { deep: true },
  )

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
      // A before_save throw is a script's veto: it lands in this catch unsaved.
      await pageController.fireEvent('before_save')
      if (await saveOrRecover()) await pageController.fireEvent('after_save')
    } catch (error: any) {
      saveError.value = errorMessage(error)
      toast.error(saveError.value)
    } finally {
      saving.value = false
    }
  }

  /** Resolves true only when the server accepted a save. */
  async function saveOrRecover(): Promise<boolean> {
    try {
      await send()
      toast.success('Saved')
      return true
    } catch (error: any) {
      if (!isTimestampMismatch(error)) throw error
      return recover(true)
    }
  }

  // The payload is the whole document: a trimmed one nulls a field it leaves out and
  // empties a child table.
  async function send() {
    paintSaved(await call('frappe.client.save', { doc: doc.value }))
  }

  /** Recovers from a concurrent edit by three-way merge, retrying at most once. */
  async function recover(mayRetry: boolean): Promise<boolean> {
    const mine = changedFields()
    const baseline = stored.value
    await docResource.reload()
    paint(docResource.data)
    const editor = editorName()

    const collisions = collidingFields(mine, fieldDiff(stored.value, baseline))
    reapply(mine, collisions)
    if (collisions.length) {
      openConflict(editor, mine, collisions)
      return false
    }
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
    return true
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
        fieldMetaByName(layout.value),
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
    doc.value = JSON.parse(JSON.stringify(saved))
    doctypeChanged(doctype.value)
    painted = true
    pageController.refresh()
  }

  return {
    doc,
    layout,
    panelLayout,
    pageController,
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

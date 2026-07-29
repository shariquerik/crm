import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { call, toast } from 'frappe-ui'
import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@/data/apps'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { errorMessage } from '@/data/errors'
import { listCache } from '@/data/cache/queryCache'

export function useDetailPage(resources: any) {
  const { record, notes, tasks, fieldsLayout } = resources
  const route = useRoute()
  const router = useRouter()

  const doc = ref<Record<string, any>>({})
  const saving = ref(false)
  const saveError = ref('')
  const activeTab = ref('notes')
  const noteTitle = ref('')
  const noteContent = ref('')
  const addingNote = ref(false)
  const taskTitle = ref('')
  const taskDueDate = ref('')
  const addingTask = ref(false)

  const viewId = typeof route.query.view === 'string' ? route.query.view : ''
  const navigation = viewId
    ? useNavigation(route.params.doctype as string, viewId, { app: APP_NAME })
    : null

  if (routeDoctype(route.params.doctype as string)) {
    record.fetch()
    fieldsLayout.fetch()
    notes.fetch()
    tasks.fetch()
  }

  const doctype = computed(() => route.params.doctype as string)
  const doctypeLink = computed(
    () => `/${encodeURIComponent(route.params.doctype as string)}`,
  )
  const viewLink = computed(() =>
    viewId ? `${doctypeLink.value}/view/${encodeURIComponent(viewId)}` : '',
  )

  const reference = computed(() => ({
    reference_doctype: doctype.value,
    reference_docname: route.params.id,
  }))

  watch(
    () => record.data,
    (data: any) => {
      doc.value = data ? { ...data } : {}
      saveError.value = ''
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

  function changedFields() {
    const stored = record.data || {}
    const changes: Record<string, any> = {}
    for (const [fieldname, value] of Object.entries(doc.value || {})) {
      if (JSON.stringify(value) !== JSON.stringify(stored[fieldname]))
        changes[fieldname] = value
    }
    return changes
  }

  async function saveDoc() {
    if (saving.value) return
    const changes = changedFields()
    if (!Object.keys(changes).length) {
      toast('No changes to save')
      return
    }

    saving.value = true
    saveError.value = ''
    try {
      await call('frappe.client.set_value', {
        doctype: doctype.value,
        name: route.params.id,
        fieldname: changes,
      })
      listCache.invalidate(doctype.value)
      await record.reload()
      toast.success('Saved')
    } catch (error: any) {
      saveError.value = errorMessage(error)
      toast.error(saveError.value)
    } finally {
      saving.value = false
    }
  }

  async function addNote() {
    if (!noteTitle.value?.trim()) {
      toast.error('A note needs a title')
      return
    }
    await insertRow(addingNote, notes, {
      doctype: 'FCRM Note',
      title: noteTitle.value.trim(),
      content: noteContent.value || '',
      ...reference.value,
    })
    if (!saveError.value) {
      noteTitle.value = ''
      noteContent.value = ''
    }
  }

  async function addTask() {
    if (!taskTitle.value?.trim()) {
      toast.error('A task needs a title')
      return
    }
    await insertRow(addingTask, tasks, {
      doctype: 'CRM Task',
      title: taskTitle.value.trim(),
      due_date: taskDueDate.value || null,
      ...reference.value,
    })
    if (!saveError.value) {
      taskTitle.value = ''
      taskDueDate.value = ''
    }
  }

  async function insertRow(
    pending: any,
    resource: any,
    row: Record<string, any>,
  ) {
    if (pending.value) return
    pending.value = true
    saveError.value = ''
    try {
      await call('frappe.client.insert', { doc: row })
      listCache.invalidate(row.doctype)
      await resource.reload()
      toast.success(`${row.doctype === 'CRM Task' ? 'Task' : 'Note'} added`)
    } catch (error: any) {
      saveError.value = errorMessage(error)
      toast.error(saveError.value)
    } finally {
      pending.value = false
    }
  }

  function goToList() {
    router.push(viewLink.value || doctypeLink.value)
  }

  return {
    doc,
    activeTab,
    noteTitle,
    noteContent,
    taskTitle,
    taskDueDate,
    saving,
    saveError,
    addingNote,
    addingTask,

    breadcrumbs,
    saveDoc,
    goToList,
    addNote,
    addTask,
  }
}

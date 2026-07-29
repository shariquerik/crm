import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { call, toast } from 'frappe-ui'
import { useNavigation } from '@framework/ui/components/Navigation'
import { APP_NAME } from '@/data/apps'
import { doctypeLabel, routeDoctype } from '@/data/doctypes'
import { errorMessage } from '@/data/errors'
import { doctypeChanged } from '@/data/doctypeChanged'
import { fetchCached } from '@/data/cache/queryCache'

const FIELDS_LAYOUT_TAG = 'CRM Fields Layout'

export function useDetailPage(resources: any) {
  const { record, fieldsLayout } = resources
  const route = useRoute()

  const doc = ref<Record<string, any>>({})
  const saving = ref(false)
  const saveError = ref('')

  const viewId = typeof route.query.view === 'string' ? route.query.view : ''
  const navigation = viewId
    ? useNavigation(route.params.doctype as string, viewId, { app: APP_NAME })
    : null

  if (routeDoctype(route.params.doctype as string) !== null) {
    const name = route.params.doctype as string
    fetchCached(record, `record:${name}/${route.params.id}`, name)
    fetchCached(fieldsLayout, `layout:${name}`, FIELDS_LAYOUT_TAG)
  }

  const doctype = computed(() => route.params.doctype as string)
  const doctypeLink = computed(
    () => `/${encodeURIComponent(route.params.doctype as string)}`,
  )
  const viewLink = computed(() =>
    viewId ? `${doctypeLink.value}/view/${encodeURIComponent(viewId)}` : '',
  )

  let painted: Record<string, any> = {}

  // The cached record paints first and the fetched one lands behind it; typing in that
  // window is the reader's, not a stale copy to overwrite.
  watch(
    () => record.data,
    (data: any) => {
      if (!saving.value && Object.keys(fieldDiff(doc.value, painted)).length)
        return
      painted = data ? { ...data } : {}
      doc.value = { ...painted }
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
    return fieldDiff(doc.value, record.data || {})
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
      doctypeChanged(doctype.value)
      await record.reload()
      toast.success('Saved')
    } catch (error: any) {
      saveError.value = errorMessage(error)
      toast.error(saveError.value)
    } finally {
      saving.value = false
    }
  }

  return {
    doc,
    saving,
    saveError,

    breadcrumbs,
    saveDoc,
  }
}

function fieldDiff(
  current: Record<string, any>,
  stored: Record<string, any>,
): Record<string, any> {
  const changes: Record<string, any> = {}
  for (const [fieldname, value] of Object.entries(current || {})) {
    if (JSON.stringify(value) !== JSON.stringify(stored?.[fieldname]))
      changes[fieldname] = value
  }
  return changes
}

import { computed, ref } from 'vue'
import { call, toast } from 'frappe-ui'
import { useFormLayout } from '@framework/ui/experimental'
import { errorMessage } from '@/data/errors'
import { doctypeChanged } from '@/data/doctypeChanged'

export function useCreateDoc(options: {
  doctype: string
  route: any
  router: any
}) {
  const { doctype, route, router } = options

  const createDialog = ref(false)
  const newDoc = ref<Record<string, any>>({})
  // Conditions read this focus-out snapshot of the draft, not the draft itself:
  // reshaping on the keystroke that satisfies them would remount under the cursor.
  const committedDoc = ref<Record<string, any>>({})
  const creating = ref(false)
  const createError = ref('')

  const { layout: createLayout } = useFormLayout({
    doctype,
    type: 'Quick Entry',
    doc: committedDoc,
  })

  const createTitle = `New ${doctype}`

  function openCreate() {
    newDoc.value = {}
    committedDoc.value = {}
    createError.value = ''
    createDialog.value = true
  }

  function commitDraft() {
    committedDoc.value = { ...newDoc.value }
  }

  async function createDoc() {
    if (creating.value) return
    creating.value = true
    createError.value = ''
    try {
      const doc = await call('frappe.client.insert', {
        doc: { doctype, ...(newDoc.value || {}) },
      })
      createDialog.value = false
      toast.success(`${doctype} created`)
      doctypeChanged(doctype)
      router.push(
        `/${encodeURIComponent(route.params.doctype)}/${encodeURIComponent(doc.name)}`,
      )
    } catch (error: any) {
      createError.value = errorMessage(error)
    } finally {
      creating.value = false
    }
  }

  const createActions = computed(() => [
    {
      label: 'Create',
      variant: 'solid',
      loading: creating.value,
      onClick: createDoc,
    },
  ])

  return {
    createDialog,
    createLayout,
    newDoc,
    creating,
    createError,
    createTitle,
    createActions,
    openCreate,
    commitDraft,
  }
}

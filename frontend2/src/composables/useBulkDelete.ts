import { computed, ref, watch } from 'vue'
import { call, toast } from 'frappe-ui'
import { errorMessage } from '@/data/errors'
import { refreshViewCounts } from '@/data/navigation'

const BACKGROUND_DELETE_THRESHOLD = 10

export function useBulkDelete(options: {
  listData: any
  doctype: string
  submit: () => void
}) {
  const { listData, doctype, submit } = options

  const selection = ref<string[]>([])
  const deleteDialog = ref(false)
  const deleting = ref(false)
  const deleteError = ref('')

  watch(
    () => listData.data,
    () => (selection.value = []),
  )

  async function deleteSelected() {
    const items = selection.value
    if (!items.length) return
    deleting.value = true
    deleteError.value = ''
    try {
      await call('crm.api.doc.delete_bulk_docs', { doctype, items })
      deleteDialog.value = false
      toast.success(
        items.length > BACKGROUND_DELETE_THRESHOLD
          ? `Deleting ${items.length} records in the background`
          : `Deleted ${items.length} record${items.length === 1 ? '' : 's'}`,
      )
      selection.value = []
      submit()
      refreshViewCounts(doctype)
    } catch (error: any) {
      deleteError.value = errorMessage(error)
    } finally {
      deleting.value = false
    }
  }

  const deleteTitle = computed(() =>
    selection.value.length === 1
      ? 'Delete 1 record?'
      : `Delete ${selection.value.length} records?`,
  )

  const bulkActions = computed(() => [
    {
      label: 'Delete',
      theme: 'red',
      onClick: () => (deleteDialog.value = true),
    },
  ])

  const deleteActions = computed(() => [
    {
      label: 'Delete',
      variant: 'solid',
      theme: 'red',
      loading: deleting.value,
      onClick: deleteSelected,
    },
  ])

  return {
    selection,
    deleteDialog,
    deleting,
    deleteError,
    deleteTitle,
    bulkActions,
    deleteActions,
  }
}

// The list's selection and the bulk delete it feeds.
import { computed, ref, watch } from "vue"
import { call, toast } from "frappe-ui"
import { errorMessage } from "@app/data/errors"

// Over this many, the server enqueues the delete and returns straight away.
const BACKGROUND_DELETE_THRESHOLD = 10

export function useBulkDelete(options: { listData: any; doctype: string; submit: () => void }) {
	const { listData, doctype, submit } = options

	const selection = ref<string[]>([])
	const deleteDialog = ref(false)
	const deleting = ref(false)
	const deleteError = ref("")

	// A refetch replaces the rows under a selection the component would otherwise keep:
	// filter something out while it's ticked and it stays selected but invisible, and Delete
	// would then hit records the user cannot see.
	watch(() => listData.data, () => (selection.value = []))

	async function deleteSelected() {
		const items = selection.value
		if (!items.length) return
		deleting.value = true
		deleteError.value = ""
		try {
			await call("crm.api.doc.delete_bulk_docs", { doctype, items })
			deleteDialog.value = false
			// the enqueued rows are still there on the next fetch — say so, rather than showing
			// a list that looks like the delete silently failed
			toast.success(
				items.length > BACKGROUND_DELETE_THRESHOLD
					? `Deleting ${items.length} records in the background`
					: `Deleted ${items.length} record${items.length === 1 ? "" : "s"}`,
			)
			selection.value = []
			submit()
		} catch (error: any) {
			// the dialog stays open holding the reason — a delete blocked by a link or by
			// permission is exactly what to show
			deleteError.value = errorMessage(error)
		} finally {
			deleting.value = false
		}
	}

	const deleteTitle = computed(() =>
		selection.value.length === 1 ? "Delete 1 record?" : `Delete ${selection.value.length} records?`,
	)

	const bulkActions = computed(() => [
		{ label: "Delete", theme: "red", onClick: () => (deleteDialog.value = true) },
	])

	const deleteActions = computed(() => [
		{
			label: "Delete",
			variant: "solid",
			theme: "red",
			loading: deleting.value,
			onClick: deleteSelected,
		},
	])

	return { selection, deleteDialog, deleting, deleteError, deleteTitle, bulkActions, deleteActions }
}

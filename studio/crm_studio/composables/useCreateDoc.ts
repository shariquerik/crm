import { computed, ref } from "vue"
import { call, toast } from "frappe-ui"
import { errorMessage } from "@app/data/errors"

export function useCreateDoc(options: { createLayout: any; doctype: string; route: any; router: any }) {
	const { createLayout, doctype, route, router } = options

	const createDialog = ref(false)
	const newDoc = ref<Record<string, any>>({})
	const creating = ref(false)
	const createError = ref("")

	const createTitle = `New ${doctype}`

	function openCreate() {
		newDoc.value = {}
		createError.value = ""
		if (!createLayout.data && !createLayout.loading) createLayout.fetch()
		createDialog.value = true
	}

	async function createDoc() {
		if (creating.value) return
		creating.value = true
		createError.value = ""
		try {
			const doc = await call("frappe.client.insert", { doc: { doctype, ...(newDoc.value || {}) } })
			createDialog.value = false
			toast.success(`${doctype} created`)
			router.push(`/${encodeURIComponent(route.params.doctype)}/${encodeURIComponent(doc.name)}`)
		} catch (error: any) {
			createError.value = errorMessage(error)
		} finally {
			creating.value = false
		}
	}

	const createActions = computed(() => [
		{ label: "Create", variant: "solid", loading: creating.value, onClick: createDoc },
	])

	return { createDialog, newDoc, creating, createError, createTitle, createActions, openCreate }
}

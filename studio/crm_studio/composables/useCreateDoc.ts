// The list's "Create" dialog: a blank doc, FormLayout's fields, and the insert.
import { computed, ref } from "vue"
import { call, toast } from "frappe-ui"
import { errorMessage } from "@app/data/errors"

export function useCreateDoc(options: { createLayout: any; doctype: string; route: any; router: any }) {
	const { createLayout, doctype, route, router } = options

	const createDialog = ref(false)
	const newDoc = ref<Record<string, any>>({})
	const creating = ref(false)
	const createError = ref("")

	// The doctype's own name, not the sidebar's plural: "New CRM Lead", never "New Leads".
	const createTitle = `New ${doctype}`

	function openCreate() {
		// a fresh blank doc each time: FormLayout edits this object in place, so reusing the
		// last one would pre-fill the form with an abandoned draft
		newDoc.value = {}
		createError.value = ""
		// fetched on the FIRST open, not with the page: a user who only browses never pays
		if (!createLayout.data && !createLayout.loading) createLayout.fetch()
		createDialog.value = true
	}

	async function createDoc() {
		if (creating.value) return
		creating.value = true
		createError.value = ""
		try {
			// the same insert CRM's own frontend does — the server enforces mandatory fields
			// and permissions, and a missing one throws with the dialog left open showing why
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

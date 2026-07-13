// Detail page: load one record, hand it to FormLayout, save the edits back.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources by
// name, its variables as refs, and route/router.
import { computed, watch } from "vue"
import { call, toast } from "frappe-ui"

export default function setup(ctx: any) {
	const { record, doc, saving, saveError, doctypeMap, doctypeLabels, route, router } = ctx
	const { notes, tasks, noteTitle, noteContent, taskTitle, taskDueDate, addingNote, addingTask } = ctx

	// The sidebar's collapsed state has to outlive the page: Studio remounts the page (and
	// the CRMSidebar component with it) on every navigation, so the `sidebarCollapsed`
	// variable backing Sidebar's `collapsed` v-model resets. localStorage is the only place
	// it can survive — rehydrate it here, persist it on every toggle.
	const { sidebarCollapsed } = ctx
	sidebarCollapsed.value = localStorage.getItem("crm-studio:sidebar-collapsed") === "true"
	watch(sidebarCollapsed, (collapsed: boolean) => {
		localStorage.setItem("crm-studio:sidebar-collapsed", collapsed ? "true" : "false")
	})

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `views` variable the
	// component renders. The list page's view picker reads the same variable: one fetch, one
	// source of truth. The call goes through `ctx.call` (Studio puts frappe-ui's `call` in
	// every script's context) rather than an import, because the pages' scripts share no set
	// of static imports — the home page imports nothing from frappe-ui.
	const { views } = ctx
	const VIEW_SLUGS: Record<string, string> = {"CRM Lead": "crm-lead", "CRM Deal": "crm-deal", "Contact": "contact", "CRM Organization": "crm-organization", "CRM Task": "crm-task", "FCRM Note": "fcrm-note"}
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {
		// Grouped by doctype, and carrying the slug: both the sidebar row and the picker
		// route by slug (`/:doctype/view/:viewName`), and a stored view only knows its `dt`.
		const grouped: Record<string, any[]> = {}
		for (const row of rows || []) {
			const slug = VIEW_SLUGS[row.dt]
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!slug || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), { ...row, slug }]
		}
		views.value = grouped
	})

	const doctype = computed(() => doctypeMap.value[route.params.doctype])

	// Every note/task hangs off the record through this pair — the same one CRM's own
	// activities API reads, so rows created here show up in CRM's frontend too.
	const reference = computed(() => ({
		reference_doctype: doctype.value,
		reference_docname: route.params.id,
	}))

	// `doc` is FormLayout's model: the user edits it in place. Every (re)fetch overwrites it
	// with what the server actually stored.
	watch(
		() => record.data,
		(data) => {
			doc.value = data ? { ...data } : {}
			saveError.value = ""
		},
		{ immediate: true },
	)

	const breadcrumbs = computed(() => [
		{
			label: doctypeLabels.value[route.params.doctype] || doctype.value,
			route: `/${route.params.doctype}`,
		},
		{ label: doc.value?.name || route.params.id },
	])

	// Only what the user touched. Writing the whole doc back would clobber fields the read
	// never returned (frappe.client.get strips nulls and perm-level-restricted fields).
	function changedFields() {
		const stored = record.data || {}
		const changes: Record<string, any> = {}
		for (const [fieldname, value] of Object.entries(doc.value || {})) {
			if (JSON.stringify(value) !== JSON.stringify(stored[fieldname])) changes[fieldname] = value
		}
		return changes
	}

	async function saveDoc() {
		if (saving.value) return
		const changes = changedFields()
		if (!Object.keys(changes).length) {
			toast("No changes to save")
			return
		}

		saving.value = true
		saveError.value = ""
		try {
			// set_value runs the full save (mandatory, permissions, hooks) on the stored doc and
			// ignores framework fields in the payload; a cleared mandatory field throws here.
			await call("frappe.client.set_value", {
				doctype: doctype.value,
				name: route.params.id,
				fieldname: changes,
			})
			await record.reload()
			toast.success("Saved")
		} catch (error: any) {
			saveError.value = errorMessage(error)
			toast.error(saveError.value)
		} finally {
			saving.value = false
		}
	}

	// The tabs' resources were built once, with this record baked into their params, so a
	// plain reload re-runs the same query — which is how a new note/task shows up without
	// the user reloading the page.
	async function addNote() {
		if (!noteTitle.value?.trim()) {
			toast.error("A note needs a title")
			return
		}
		await insertRow(addingNote, notes, {
			doctype: "FCRM Note",
			title: noteTitle.value.trim(),
			content: noteContent.value || "",
			...reference.value,
		})
		if (!saveError.value) {
			noteTitle.value = ""
			noteContent.value = ""
		}
	}

	async function addTask() {
		if (!taskTitle.value?.trim()) {
			toast.error("A task needs a title")
			return
		}
		await insertRow(addingTask, tasks, {
			doctype: "CRM Task",
			title: taskTitle.value.trim(),
			// a Datetime Frappe won't parse is worse than no due date at all
			due_date: taskDueDate.value || null,
			...reference.value,
		})
		if (!saveError.value) {
			taskTitle.value = ""
			taskDueDate.value = ""
		}
	}

	async function insertRow(pending: any, resource: any, row: Record<string, any>) {
		if (pending.value) return
		pending.value = true
		saveError.value = ""
		try {
			// the same insert CRM's own frontend does — no CRM-specific endpoint needed
			await call("frappe.client.insert", { doc: row })
			await resource.reload()
			toast.success(`${row.doctype === "CRM Task" ? "Task" : "Note"} added`)
		} catch (error: any) {
			saveError.value = errorMessage(error)
			toast.error(saveError.value)
		} finally {
			pending.value = false
		}
	}

	// frappe-ui's `call` rejects with the server messages attached (e.g. "Value missing for
	// CRM Lead: First Name"); never swallow them.
	function errorMessage(error: any) {
		if (error?.messages?.length) return error.messages.join("\n")
		return error?.message || "Something went wrong"
	}

	function goToList() {
		router.push(`/${route.params.doctype}`)
	}

	return { breadcrumbs, saveDoc, goToList, addNote, addTask }
}

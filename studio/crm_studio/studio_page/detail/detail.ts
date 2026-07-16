// Detail page (/:doctype/:id): load one record, hand it to FormLayout, save the edits back.
import { computed, ref, watch } from "vue"
import { call, toast } from "frappe-ui"
import { doctypeLabels, fetchViews, guardDoctype } from "@app/data/doctypes"
import { errorMessage } from "@app/data/errors"

export default function setup(ctx: any) {
	const { record, notes, tasks, fieldsLayout, route, router } = ctx

	const views = fetchViews(ctx)
	const doc = ref<Record<string, any>>({})
	const saving = ref(false)
	const saveError = ref("")
	const activeTab = ref("notes")
	const noteTitle = ref("")
	const noteContent = ref("")
	const addingNote = ref(false)
	const taskTitle = ref("")
	const taskDueDate = ref("")
	const addingTask = ref(false)

	// Every resource here is auto=0: they all take the route's doctype, so none may fire until the
	// server has confirmed the route actually names one.
	guardDoctype(
		ctx,
		() => {
			record.fetch()
			fieldsLayout.fetch()
			notes.fetch()
			tasks.fetch()
		},
		`/${encodeURIComponent(route.params.id)}`,
	)

	const doctype = computed(() => route.params.doctype)
	const doctypeLink = computed(() => `/${encodeURIComponent(route.params.doctype)}`)

	// The pair every note/task hangs off — the same one CRM's own activities API reads, so rows
	// created here show up in CRM's frontend too.
	const reference = computed(() => ({
		reference_doctype: doctype.value,
		reference_docname: route.params.id,
	}))

	// `doc` is FormLayout's model: the user edits it in place, and every (re)fetch overwrites it.
	watch(
		() => record.data,
		(data) => {
			doc.value = data ? { ...data } : {}
			saveError.value = ""
		},
		{ immediate: true },
	)

	const breadcrumbs = computed(() => [
		{ label: doctypeLabels[doctype.value] || doctype.value, route: doctypeLink.value },
		{ label: doc.value?.name || route.params.id },
	])

	// Only what the user touched: writing the whole doc back would clobber fields the read never
	// returned (frappe.client.get strips nulls and perm-level-restricted fields).
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
			// ignores framework fields in the payload.
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

	function goToList() {
		router.push(doctypeLink.value)
	}

	return {
		doc,
		activeTab,
		noteTitle,
		noteContent,
		taskTitle,
		taskDueDate,
		views,
		doctypeLabels,
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

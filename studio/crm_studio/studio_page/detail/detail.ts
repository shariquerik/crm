// Detail page: load one record, hand it to FormLayout, save the edits back.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources by
// name, its variables as refs, and route/router.
import { computed, watch } from "vue"
import { call, toast } from "frappe-ui"

export default function setup(ctx: any) {
	const { record, doc, saving, saveError, doctypeLabels, route, router } = ctx
	const { notes, tasks, noteTitle, noteContent, taskTitle, taskDueDate, addingNote, addingTask } = ctx
	const { fieldsLayout } = ctx

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `views` variable the
	// component renders. The list page's view picker reads the same variable: one fetch, one
	// source of truth. The call goes through `ctx.call` (Studio puts frappe-ui's `call` in
	// every script's context) rather than an import, because the pages' scripts share no set
	// of static imports — the home page imports nothing from frappe-ui.
	const { views } = ctx
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {
		// Grouped by the doctype they belong to — which is also all a row needs to build its
		// URL, since the route carries the doctype name itself (`/:doctype/view/:viewName`).
		// So a view on ANY doctype routes correctly, not just the six the sidebar advertises.
		const grouped: Record<string, any[]> = {}
		for (const row of rows || []) {
			// A standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app (ADR-0002).
			if (!row.dt || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), row]
		}
		views.value = grouped
	})
	// Nothing is fetched until the server has resolved the route's doctype: a typo must not
	// fire a get_data for a doctype that does not exist, and a slug URL is about to be
	// replaced by its canonical one anyway (which re-runs this whole setup).
	function guardDoctype(onResolved: () => void, suffix = "") {
		const { routeDoctype } = ctx
		let done = false
		watch(
			() => routeDoctype.data,
			(res: any) => {
				if (done || !res) return
				// resolved to nothing — the Not Found panel is what renders; do NOT fetch.
				if (!res.doctype) return
				if (res.doctype !== route.params.doctype) {
					// a slug or a different casing: send the browser to the canonical URL.
					// replace(), not push(), so Back doesn't bounce through the alias.
					done = true
					router.replace(`/${encodeURIComponent(res.doctype)}${suffix}`)
					return
				}
				done = true
				onResolved()
			},
			{ immediate: true },
		)
	}

	// Every resource on this page is auto=0: they all take the route's doctype, so none of
	// them may fire until the server has confirmed the route actually names one (and that the
	// URL is its canonical spelling — a slug is redirected instead, which re-runs this setup).
	guardDoctype(() => {
		record.fetch()
		fieldsLayout.fetch()
		notes.fetch()
		tasks.fetch()
	}, `/${encodeURIComponent(route.params.id)}`)

	// The route carries the doctype name itself ("CRM Lead"), already decoded by vue-router
	// — no lookup, so a record of ANY doctype opens here. See config.py.
	const doctype = computed(() => route.params.doctype)
	// ...but a LINK back to it has to re-encode the space.
	const doctypeLink = computed(() => `/${encodeURIComponent(route.params.doctype)}`)

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
			// The curated doctypes have a nicer plural ("Leads"); anything else is shown as
			// its own name.
			label: doctypeLabels.value[doctype.value] || doctype.value,
			route: doctypeLink.value,
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
		router.push(doctypeLink.value)
	}

	return { breadcrumbs, saveDoc, goToList, addNote, addTask }
}

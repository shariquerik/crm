// Detail page: load one record, hand it to FormLayout, save the edits back.
//
// setup(ctx) runs in a per-navigation effect scope. `ctx` holds the page's resources by
// name and route/router.
//
// The page's STATE is declared here too, as plain refs, rather than in the Studio Variables
// panel — one place to read the page from, next to the code that drives it, with a real
// initial value instead of a JSON string. A returned ref binds exactly like a panel
// variable: a block's `{{ }}` reads it unwrapped, and a two-way `$type: variable` prop
// writes straight through to `.value` (codeStore's setValueInVariable checks isRef). Two
// constraints come with it, and both hold here: the binding must be a REF (a plain object
// bound with v-model would be written to a phantom variable instead), and a resource's
// creation params can't see these — they are evaluated against the panel's variables +
// route/router only, and every resource on this page takes the route alone.
import { computed, ref, watch } from "vue"
import { call, toast } from "frappe-ui"

// The curated doctypes' nicer plurals, read by the breadcrumb here and by the block tree
// ({{ doctypeLabels[route.params.doctype] }}). A frozen lookup, never written, so it is a
// plain object rather than a ref — a `{{ }}` read unwraps a binding whether or not it is
// one. (Anything the blocks bind TWO-WAY must still be a ref; see the note above.)
const doctypeLabels: Record<string, string> = {
	"CRM Lead": "Leads",
	"CRM Deal": "Deals",
	Contact: "Contacts",
	"CRM Organization": "Organizations",
	"CRM Task": "Tasks",
	"FCRM Note": "Notes",
}

export default function setup(ctx: any) {
	// Resources stay on ctx — Studio owns their lifecycle, and only it can create them.
	const { record, notes, tasks, fieldsLayout, route, router } = ctx

	// --- page state ---------------------------------------------------------------------
	// The saved views the sidebar renders, grouped by doctype (fetched below).
	const views = ref<Record<string, any[]>>({})
	// FormLayout's model: the user edits this in place (two-way), and every (re)fetch of the
	// record overwrites it with what the server actually stored.
	const doc = ref<Record<string, any>>({})
	const saving = ref(false)
	const saveError = ref("")
	// Which of the two tabs is showing — the block tree v-models this and keys both panels off it.
	const activeTab = ref("notes")
	// The notes tab's composer.
	const noteTitle = ref("")
	const noteContent = ref("")
	const addingNote = ref(false)
	// The tasks tab's composer.
	const taskTitle = ref("")
	const taskDueDate = ref("")
	const addingTask = ref(false)

	// Saved views hang under their doctype in the sidebar, so EVERY page needs them — but a
	// Studio Component cannot declare a resource of its own, so the fetch lives here, in the
	// snippet every page splices into its setup(), and lands in the `views` ref the component
	// renders. The list page's view picker reads the same ref: one fetch, one source of truth.
	// The call goes through `ctx.call` (Studio puts frappe-ui's `call` in every script's
	// context) rather than an import, because the pages' scripts share no set of static
	// imports — the home page imports nothing from frappe-ui.
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
			label: doctypeLabels[doctype.value] || doctype.value,
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

	// Exposed to the block expressions. The state declared at the top has to come back out
	// through here, exactly as the computeds and handlers do, or the blocks binding it by name
	// would read `undefined`. The refs are returned AS refs — a `{{ }}` read unwraps them, and
	// a two-way `$type: variable` prop needs the ref itself to write through.
	return {
		// State the block tree binds by name. doc/activeTab/note*/task* are bound two-way.
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

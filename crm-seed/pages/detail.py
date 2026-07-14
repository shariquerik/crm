"""The detail page at `/:doctype/:id` — one record, rendered by @framework/ui's FormLayout.

Generic like the list page (ADR-0002): the doctype comes from the URL slug, so the same
page renders a lead, a deal or a contact. Nothing per-doctype lives here.

The form is CRM's own "Data Fields" layout (crm_fields_layout.get_fields_layout) — the
tab -> section -> column -> fields tree CRM shows on a record's detail screen. It is
already FormLayoutSchema-shaped; only the leaf docfields need mapping (snake_case Frappe
docfield -> camelCase FieldMeta), which the resource's `transform` does. When a doctype
has no CRM Fields Layout document, get_fields_layout synthesizes one from doctype meta —
which is why this works for Contact and Organization too, not just Lead and Deal.

Below the form sit the Notes and Tasks tabs (ADR-0002's v1 cut; Activity/Emails/Calls/
WhatsApp are deferred). Both are CRM's own doctypes — `FCRM Note` and `CRM Task` — which
point at their parent through a generic `reference_doctype` + `reference_docname` pair
rather than per-doctype link fields. That is what keeps this page generic (a note on a
lead and a note on a deal are the same write), and it is also why anything created here
shows up in CRM's own frontend: `crm.api.activities.get_activities` reads that same pair.
"""

import json

import blocks
import config
import doctype_guard
from components import crm_sidebar

PAGE_NAME = "crm-detail"

# One of Quick Entry | Side Panel | Data Fields | Grid Row | Required Fields.
# "Data Fields" is the detail screen's fields panel: multi-column, expanded, and the only
# type that is purely fields (Side Panel mixes in CRM's contacts/lost-reason widgets and
# leaves unresolvable fieldnames as bare strings).
FIELDS_LAYOUT_TYPE = "Data Fields"

# Frappe docfield (snake_case, 0/1) -> FieldMeta (camelCase, booleans), keeping CRM's
# tab/section/column tree as-is. Runs as the layout resource's `transform`.
FIELDS_LAYOUT_TRANSFORM = """
function transform(tabs) {
	const LAYOUT_BREAKS = ["Tab Break", "Section Break", "Column Break"]
	// get_fields_layout carries no child-table meta, so a grid would render column-less.
	// Child tables are out of scope for v1's form.
	const CHILD_TABLES = ["Table", "Table MultiSelect"]

	function toFieldMeta(field) {
		return {
			fieldname: field.fieldname,
			fieldtype: field.fieldtype,
			label: field.label,
			// Select options are a newline-joined string in meta; CRM hands some layouts
			// back as [{label, value}] instead.
			options: Array.isArray(field.options)
				? field.options.map((option) => (option && option.value !== undefined ? option.value : option)).join("\\n")
				: field.options,
			reqd: Boolean(field.reqd),
			hidden: Boolean(field.hidden),
			readOnly: Boolean(field.read_only) || field.fieldtype === "Read Only",
			precision: field.precision ? Number(field.precision) : undefined,
			description: field.description || undefined,
			placeholder: field.placeholder || undefined,
			dependsOn: field.depends_on || undefined,
			mandatoryDependsOn: field.mandatory_depends_on || undefined,
			readOnlyDependsOn: field.read_only_depends_on || undefined,
		}
	}

	return (tabs || []).map(function (tab) {
		return {
			name: tab.name,
			label: tab.label,
			sections: (tab.sections || []).map(function (section) {
				return {
					name: section.name,
					label: section.label,
					hideLabel: Boolean(section.hideLabel),
					hideBorder: Boolean(section.hideBorder),
					collapsible: Boolean(section.collapsible),
					opened: section.opened !== false,
					columns: (section.columns || []).map(function (column) {
						return {
							name: column.name,
							fields: (column.fields || [])
								// a fieldname the doctype no longer has stays an unexpanded string
								.filter((field) => field && typeof field === "object")
								.filter((field) => !LAYOUT_BREAKS.includes(field.fieldtype) && !CHILD_TABLES.includes(field.fieldtype))
								.map(toFieldMeta),
						}
					}),
				}
			}),
		}
	})
}
""".strip()

# The two v1 tabs. `value` is what the `activeTab` variable holds.
TABS = [
	{"label": "Notes", "value": "notes"},
	{"label": "Tasks", "value": "tasks"},
]

# A note's body is a Text Editor field, i.e. HTML. ListView prints a cell as plain text,
# so "<p>hi</p>" would show its tags — hence a stripped one-line preview, built in the
# resource transform (ListView takes no per-column render function through Studio's prop
# bindings, which are JSON).
NOTES_TRANSFORM = """
function transform(notes) {
	return (notes || []).map(function (note) {
		const text = new DOMParser().parseFromString(note.content || "", "text/html").body.textContent || ""
		return { ...note, preview: text.replace(/\\s+/g, " ").trim() }
	})
}
""".strip()

SCRIPT = ("""
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
""" + crm_sidebar.PAGE_SETUP + doctype_guard.PAGE_SETUP + """

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
		if (error?.messages?.length) return error.messages.join("\\n")
		return error?.message || "Something went wrong"
	}

	function goToList() {
		router.push(doctypeLink.value)
	}

	return { breadcrumbs, saveDoc, goToList, addNote, addTask }
}
""").lstrip()


def build() -> dict:
	header = blocks.container(
		"detail-header",
		styles={
			"flexDirection": "row",
			"alignItems": "center",
			"justifyContent": "space-between",
			"gap": "12px",
		},
		children=[
			blocks.block(
				"Breadcrumbs",
				"detail-breadcrumbs",
				props={"items": "{{ breadcrumbs }}"},
			),
			blocks.block(
				"Button",
				"detail-save",
				props={"label": "Save", "variant": "solid", "loading": "{{ saving }}"},
				events={"click": blocks.event("click", "function handleEvent() { saveDoc() }")},
			),
		],
	)

	# A save that fails must say so: the banner stays until the next fetch or save.
	error = blocks.block(
		"ErrorMessage",
		"detail-error",
		props={"message": "{{ saveError }}"},
		visibility="{{ saveError }}",
	)

	form = blocks.block(
		"FormLayout",
		"detail-form",
		props={
			"layout": "{{ fieldsLayout.data || [] }}",
			# two-way: FormLayout's `defineModel("doc")` writes edits straight back
			"doc": blocks.bind("doc"),
		},
		# Don't mount until the layout has actually loaded: FormLayout renders frappe-ui's
		# Tabs, which reads `props.tabs[0].label` unguarded (Tabs.vue:73), so an empty
		# layout — which is what the first paint has, before the resource resolves —
		# throws in the render function.
		visibility="{{ fieldsLayout.data?.length }}",
	)

	tabs = _tabs()

	body = blocks.container(
		"detail-body",
		styles={
			"padding": "24px",
			"gap": "16px",
			"flexGrow": "1",
			"overflowY": "auto",
			# the sidebar is a flex sibling now: without this the form's intrinsic width
			# wins and the body overflows instead of shrinking
			"minWidth": "0",
		},
		children=[header, error, form, tabs],
		# Renders only once the guard has confirmed the route's doctype; its sibling is the
		# Not Found panel.
		visibility=doctype_guard.RESOLVED,
	)

	return {
		"page_name": PAGE_NAME,
		"page_title": "Detail",
		"route": "/:doctype/:id",
		# A record keeps its own doctype's entry lit, so that doctype is the highlight.
		"blocks": blocks.root(
			[
				crm_sidebar.instance("{{ route.params.doctype }}"),
				body,
				doctype_guard.block("detail-not-found"),
			]
		),
		"resources": [
			crm_sidebar.RESOURCE,
			doctype_guard.RESOURCE,
			{
				"resource_name": "record",
				"resource_type": "API Resource",
				"url": "frappe.client.get",
				"method": "GET",
				# fired by the guard — see the page script
				"auto": 0,
				# params are evaluated ONCE, against {variables, route, router} — which is all
				# this needs, because the route carries the doctype name itself.
				"params": json.dumps(
					{
						"doctype": "{{ route.params.doctype }}",
						"name": "{{ route.params.id }}",
					}
				),
				"transform": "",
			},
			{
				"resource_name": "fieldsLayout",
				"resource_type": "API Resource",
				"url": "crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout",
				"method": "GET",
				"auto": 0,  # fired by the guard
				"params": json.dumps(
					{
						"doctype": "{{ route.params.doctype }}",
						"type": FIELDS_LAYOUT_TYPE,
					}
				),
				"transform": FIELDS_LAYOUT_TRANSFORM,
			},
			_child_resource(
				"notes",
				"FCRM Note",
				fields=["name", "title", "content", "modified"],
				transform=NOTES_TRANSFORM,
			),
			_child_resource(
				"tasks",
				"CRM Task",
				fields=["name", "title", "status", "priority", "due_date"],
			),
		],
		"variables": [
			*crm_sidebar.VARIABLES,
			# doctype -> its nicer plural, for the breadcrumb. Only the curated doctypes have
			# one; a record of any OTHER doctype still opens here (the route carries the name,
			# so there is nothing to register) and falls back to showing the doctype itself.
			{
				"variable_name": "doctypeLabels",
				"variable_type": "Object",
				"initial_value": config.DOCTYPE_LABELS,
			},
			{"variable_name": "doc", "variable_type": "Object", "initial_value": {}},
			{"variable_name": "saving", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "saveError", "variable_type": "String", "initial_value": ""},
			{"variable_name": "activeTab", "variable_type": "String", "initial_value": TABS[0]["value"]},
			{"variable_name": "noteTitle", "variable_type": "String", "initial_value": ""},
			{"variable_name": "noteContent", "variable_type": "String", "initial_value": ""},
			{"variable_name": "addingNote", "variable_type": "Boolean", "initial_value": False},
			{"variable_name": "taskTitle", "variable_type": "String", "initial_value": ""},
			{"variable_name": "taskDueDate", "variable_type": "String", "initial_value": ""},
			{"variable_name": "addingTask", "variable_type": "Boolean", "initial_value": False},
		],
		"script": SCRIPT,
	}


def _child_resource(name: str, doctype: str, fields: list[str], transform: str = "") -> dict:
	"""Notes/tasks for the record in the URL, newest first.

	get_list rather than crm.api.activities.get_activities: that endpoint sniffs Lead vs
	Deal from the docname and would defeat the point of a generic page. The filter pair is
	the same one it reads, so both sides see the same rows.
	"""
	return {
		"resource_name": name,
		"resource_type": "API Resource",
		"url": "frappe.client.get_list",
		"method": "POST",  # `filters` is a dict; a GET would send it as "[object Object]"
		"auto": 0,  # fired by the guard, like every other resource here
		"params": json.dumps(
			{
				"doctype": doctype,
				"fields": fields,
				# Only TOP-LEVEL param values are evaluated (codeStore.getAPIParams does not
				# walk into them), so the whole filter object has to be one expression.
				"filters": (
					"{{ ({ reference_doctype: route.params.doctype,"
					" reference_docname: route.params.id }) }}"
				),
				"order_by": "creation desc",
				"limit_page_length": 50,
			}
		),
		"transform": transform,
	}


def _tabs() -> dict:
	"""The tab strip plus one panel per tab, under the fields panel.

	Not frappe-ui's `Tabs`: it has a single `tab-panel` slot rendered once per tab, so every
	panel would show the same blocks — the per-tab content a page like this needs cannot be
	expressed. TabButtons + a `activeTab` variable + `visibilityCondition` on each panel is
	the same UI with the panels actually distinct.
	"""
	return blocks.container(
		"detail-tabs",
		styles={"gap": "12px", "marginTop": "8px"},
		children=[
			blocks.block(
				"TabButtons",
				"detail-tab-buttons",
				props={"options": TABS, "modelValue": blocks.bind("activeTab")},
			),
			_panel(
				"notes",
				composer=blocks.container(
					"detail-notes-composer",
					styles={"gap": "8px"},
					children=[
						_field("note-title", "Title", placeholder="Note title", model="noteTitle"),
						_field(
							"note-content",
							"Note",
							placeholder="Write a note…",
							model="noteContent",
							field_type="textarea",
							extra={"rows": 3},
						),
						blocks.container(
							"detail-note-actions",
							styles={"flexDirection": "row", "justifyContent": "flex-end"},
							children=[_add_button("note-add", "Add note", "addNote()", loading="addingNote")],
						),
					],
				),
				rows=_rows(
					"notes",
					columns=[
						{"label": "Title", "key": "title", "width": "16rem"},
						{"label": "Note", "key": "preview", "width": "28rem"},
						{"label": "Last Modified", "key": "modified", "width": "12rem"},
					],
					empty="No notes yet",
					empty_hint="Notes you add here also show up on this record in CRM.",
				),
			),
			_panel(
				"tasks",
				composer=blocks.container(
					"detail-tasks-composer",
					styles={"flexDirection": "row", "alignItems": "flex-end", "gap": "8px"},
					children=[
						_field("task-title", "Title", placeholder="Task title", model="taskTitle"),
						_field(
							"task-due-date",
							"Due date",
							placeholder="Optional",
							model="taskDueDate",
							field_type="datetime",
							styles={"width": "16rem", "flexGrow": "0", "flexShrink": "0"},
						),
						_add_button("task-add", "Add task", "addTask()", loading="addingTask"),
					],
				),
				rows=_rows(
					"tasks",
					columns=[
						{"label": "Title", "key": "title", "width": "20rem"},
						{"label": "Status", "key": "status", "width": "10rem"},
						{"label": "Priority", "key": "priority", "width": "10rem"},
						{"label": "Due Date", "key": "due_date", "width": "14rem"},
					],
					empty="No tasks yet",
					empty_hint="Tasks you add here also show up on this record in CRM.",
				),
			),
		],
	)


def _panel(tab: str, composer: dict, rows: dict) -> dict:
	"""One tab's content: an add form on top of the list. Hidden panels are not rendered at
	all — `visibilityCondition` compiles to a v-if, so the inactive tab costs nothing."""
	return blocks.container(
		f"detail-{tab}-panel",
		visibility=f"{{{{ activeTab === '{tab}' }}}}",
		styles={"gap": "12px"},
		children=[composer, rows],
	)


def _field(
	component_id: str,
	label: str,
	placeholder: str,
	model: str,
	field_type: str = "text",
	extra: dict | None = None,
	styles: dict | None = None,
) -> dict:
	props = {"type": field_type, "label": label, "placeholder": placeholder, "modelValue": blocks.bind(model)}
	props.update(extra or {})
	base = {"flexGrow": "1", "minWidth": "0"}
	base.update(styles or {})
	return blocks.block("FormControl", component_id, props=props, styles=base)


def _add_button(component_id: str, label: str, handler: str, loading: str) -> dict:
	return blocks.block(
		"Button",
		component_id,
		props={"label": label, "variant": "solid", "loading": f"{{{{ {loading} }}}}"},
		events={"click": blocks.event("click", f"function handleEvent() {{ {handler} }}")},
	)


def _rows(name: str, columns: list[dict], empty: str, empty_hint: str) -> dict:
	return blocks.block(
		"ListView",
		f"detail-{name}-rows",
		props={
			"columns": columns,
			"rows": f"{{{{ {name}.data || [] }}}}",
			"rowKey": "name",
			"options": {
				"selectable": False,
				"showTooltip": True,
				# ListEmptyState reads options.emptyState unguarded, so it must be present
				# whenever `options` is passed at all — an empty result would throw otherwise.
				"emptyState": {"title": empty, "description": empty_hint},
			},
		},
		styles={"minHeight": "180px", "width": "100%"},
	)

import { watch } from "vue"

export default function setup(ctx: any) {
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

	return {}
}

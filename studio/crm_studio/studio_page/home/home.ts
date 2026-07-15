export default function setup(ctx: any) {
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

	return {}
}

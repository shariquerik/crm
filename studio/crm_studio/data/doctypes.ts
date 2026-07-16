// The CRM doctypes this app routes over: their display names and rail icons, the route
// guard every page fetches behind, and the saved views the sidebar renders.
import { ref, watch } from "vue"

// A `lucide-*` icon is a CSS class Tailwind only emits where it SCANS the name — frappe-ui
// registers lucide through a matchComponents pack, so a name built at runtime compiles to no
// rule and renders blank. Studio's tailwind content covers this file
// (`../../*/studio/**/*.ts`), which makes the table both the icon choice and the JIT safelist.
const DOCTYPES: Record<string, { label: string; icon: string }> = {
	"CRM Lead": { label: "Leads", icon: "lucide-users" },
	"CRM Deal": { label: "Deals", icon: "lucide-handshake" },
	Contact: { label: "Contacts", icon: "lucide-contact-round" },
	"CRM Organization": { label: "Organizations", icon: "lucide-building-2" },
	"CRM Task": { label: "Tasks", icon: "lucide-list-checks" },
	"FCRM Note": { label: "Notes", icon: "lucide-notebook-pen" },
}

// A map rather than a lookup function, because page block JSON indexes it directly:
// `{{ doctypeLabels[route.params.doctype] || route.params.doctype }}`.
export const doctypeLabels: Record<string, string> = Object.fromEntries(
	Object.entries(DOCTYPES).map(([doctype, { label }]) => [doctype, label]),
)

export function doctypeIcon(doctype: string) {
	return DOCTYPES[doctype]?.icon ?? "lucide-file"
}

// Defers `onResolved` until the server confirms the route names a real doctype, so a typo
// never fires a query for a doctype that does not exist. A slug or a different casing is
// redirected to the canonical URL instead, which re-runs the page's setup.
export function guardDoctype(ctx: any, onResolved: () => void, suffix = "") {
	const { routeDoctype, route, router } = ctx
	let done = false
	watch(
		() => routeDoctype.data,
		(res: any) => {
			if (done || !res) return
			// resolved to nothing — the Not Found panel renders; do NOT fetch
			if (!res.doctype) return
			if (res.doctype !== route.params.doctype) {
				done = true
				// replace(), not push(), so Back doesn't bounce through the alias
				router.replace(`/${encodeURIComponent(res.doctype)}${suffix}`)
				return
			}
			done = true
			onResolved()
		},
		{ immediate: true },
	)
}

// The saved views the sidebar renders, grouped by doctype. A Studio Component cannot
// declare a resource of its own, so every page fetches these and hands them to the shell.
// Goes through ctx.call rather than an import because the pages share no static imports.
export function fetchViews(ctx: any) {
	const views = ref<Record<string, any[]>>({})
	ctx.call("crm.api.views.get_views").then((rows: any[]) => {
		const grouped: Record<string, any[]> = {}
		for (const row of rows || []) {
			// a standard view IS the doctype's default (unsaved) view, not a saved one;
			// kanban/group_by views have no screen in this app
			if (!row.dt || row.is_standard || (row.type && row.type !== "list")) continue
			grouped[row.dt] = [...(grouped[row.dt] || []), row]
		}
		views.value = grouped
	})
	return views
}

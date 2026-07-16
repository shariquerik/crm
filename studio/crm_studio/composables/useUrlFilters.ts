// The URL is the source of truth for a list's narrowing, in both directions: `?status=Open` reads
// in, and editing the toolbar writes back. The app re-runs setup on route.PATH changes only, so
// writing the QUERY cannot feed back into the read — and equally, nothing else would re-read it
// on Back/Forward. Hence the watches.
//
// Inert on a saved view, where the narrowing comes from the stored view instead.
import { watch, type Ref } from "vue"
import { getFilterableFields } from "@framework/ui/Filter"
import { completeFilters, toConditions, toFiltersDict } from "@app/data/listWire"

export function useUrlFilters(options: {
	filters: Ref<any[]>
	metaFields: Ref<any[]>
	doctype: string
	currentView: any
	router: any
}) {
	const { filters, metaFields, doctype, currentView, router } = options

	// Studio hands the router to a script inside a Vue ref, so what arrives is a reactive PROXY of
	// the router — and a proxy unwraps the refs hanging off it. `currentRoute` is therefore the
	// route itself, not the Ref<Route> vue-router's types promise (reading `.value` off it is
	// undefined, which took the script down). Both shapes still track.
	const liveRoute = () => ((router.currentRoute as any)?.value ?? router.currentRoute) as any
	const liveQuery = () => (liveRoute()?.query || {}) as Record<string, unknown>

	let urlApplied = false
	// What we last wrote ourselves, so the watch can tell OUR write (which must not re-read, or a
	// `like`'s bare value would round-trip through its %-wrapped form on every keystroke) from
	// someone else's — Back/Forward/paste, which must.
	let written = ""

	watch(
		[metaFields, liveQuery],
		([fields, query]: [any[], Record<string, unknown>]) => {
			if (!fields.length) return
			if (urlApplied && (currentView || stable(query) === written)) return
			urlApplied = true
			const conditions = urlConditions(fields, query)
			// the first read of a URL with no filters must not touch `filters`, or it would fire
			// the refetch watch before the guard's own first fetch
			if (conditions.length || filters.value?.length) filters.value = conditions
		},
		{ immediate: true, deep: true },
	)

	// Only once the URL has been read: `filters` starts empty, and an empty mirror would wipe the
	// very query it is about to be seeded from.
	watch(
		filters,
		() => {
			if (urlApplied) syncUrl()
		},
		{ deep: true },
	)

	// Two URL forms: `?status=Open` (a bare value means equals) and `?name=["LIKE","%A%"]`.
	function urlConditions(fields: any[], query: Record<string, unknown>) {
		const filterable = getFilterableFields(fields, doctype)
		const byName = new Map(filterable.map((f: any) => [f.fieldname, f]))
		const wire: [string, string, unknown][] = []
		for (const [fieldname, raw] of Object.entries(query || {})) {
			if (typeof raw !== "string" || !raw) continue
			const field = byName.get(fieldname)
			if (field) wire.push([fieldname, ...toWirePair(field, raw)])
		}
		return toConditions(doctype, fields, wire)
	}

	function toWirePair(field: any, raw: string): [string, unknown] {
		try {
			const parsed = JSON.parse(raw)
			// A STRING head tells an explicit pair from a bare JSON value that merely looks like
			// one (?tags=["a","b"] is a two-element list, not an operator and an argument).
			if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === "string") {
				return [parsed[0], parsed[1]]
			}
		} catch {
			// not JSON
		}
		return ["=", equalsValue(field, raw)]
	}

	// parseFilters only surfaces a Check as the Yes/No its control renders when the value is a
	// real boolean, so `?converted=1` would otherwise sit in the row as the string "1".
	function equalsValue(field: any, raw: string) {
		if (field.fieldtype !== "Check") return raw
		return ["1", "true", "yes"].includes(raw.toLowerCase())
	}

	function syncUrl() {
		// Only the rendered app owns its address bar. In the builder this same script runs against
		// the BUILDER's router, where a filter would scribble onto the editor's URL.
		if (!(window as any).app_name) return
		if (currentView) return

		const query: Record<string, unknown> = {}
		// Every filterable field is this page's to own, so a REMOVED filter leaves the URL with it.
		// Anything else a link carried (?view=…) is not ours, and stays.
		const owned = new Set(getFilterableFields(metaFields.value, doctype).map((f: any) => f.fieldname))
		const current = liveQuery()
		for (const [key, value] of Object.entries(current)) {
			if (!owned.has(key)) query[key] = value
		}
		for (const [fieldname, pair] of Object.entries(toFiltersDict(completeFilters(filters.value)))) {
			query[fieldname] = toQueryValue(pair)
		}

		const encoded = stable(query)
		if (encoded === stable(current)) return
		written = encoded
		// Adding or removing a filter earns a history entry. Editing a value does not — an entry
		// per keystroke would make Back useless.
		const structural = Object.keys(query).sort().join() !== Object.keys(current).sort().join()
		if (structural) router.push({ query })
		else router.replace({ query })
	}
}

function toQueryValue([operator, value]: [string, unknown]) {
	if (operator !== "=") return JSON.stringify([operator, value])
	// a Check's `=` is a real boolean by here; "1"/"0" is what equalsValue reads back
	if (typeof value === "boolean") return value ? "1" : "0"
	return String(value)
}

// Answers "same narrowing?", not "same object": the router hands the query back in its own key
// order, and a plain stringify would read that as a change — write, re-read, write, forever.
function stable(query: Record<string, unknown>) {
	return JSON.stringify(Object.keys(query).sort().map((key) => [key, query[key]]))
}

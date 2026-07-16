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

	const liveRoute = () => ((router.currentRoute as any)?.value ?? router.currentRoute) as any
	const liveQuery = () => (liveRoute()?.query || {}) as Record<string, unknown>

	let urlApplied = false
	let written = ""

	watch(
		[metaFields, liveQuery],
		([fields, query]: [any[], Record<string, unknown>]) => {
			if (!fields.length) return
			if (urlApplied && (currentView || stable(query) === written)) return
			urlApplied = true
			const conditions = urlConditions(fields, query)
			if (conditions.length || filters.value?.length) filters.value = conditions
		},
		{ immediate: true, deep: true },
	)

	watch(
		filters,
		() => {
			if (urlApplied) syncUrl()
		},
		{ deep: true },
	)

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
			if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === "string") {
				return [parsed[0], parsed[1]]
			}
		} catch {}
		return ["=", equalsValue(field, raw)]
	}

	function equalsValue(field: any, raw: string) {
		if (field.fieldtype !== "Check") return raw
		return ["1", "true", "yes"].includes(raw.toLowerCase())
	}

	function syncUrl() {
		if (!(window as any).app_name) return
		if (currentView) return

		const query: Record<string, unknown> = {}
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
		const structural = Object.keys(query).sort().join() !== Object.keys(current).sort().join()
		if (structural) router.push({ query })
		else router.replace({ query })
	}
}

function toQueryValue([operator, value]: [string, unknown]) {
	if (operator !== "=") return JSON.stringify([operator, value])
	if (typeof value === "boolean") return value ? "1" : "0"
	return String(value)
}

function stable(query: Record<string, unknown>) {
	return JSON.stringify(Object.keys(query).sort().map((key) => [key, query[key]]))
}

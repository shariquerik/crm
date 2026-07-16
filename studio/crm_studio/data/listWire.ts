// The list controls' native shapes (FilterCondition[] / Sort[] / Column[]) turned into what
// `crm.api.doc.get_data` takes, and back again. Pure: nothing here fetches or holds state.
import { getFilterableFields, parseFilters, serializeFilters } from "@framework/ui/Filter"

// get_data's `filters` is a DICT, so one condition per field: a second on the same field wins.
export function toFiltersDict(conditions: any[]) {
	const dict: Record<string, [string, unknown]> = {}
	for (const [fieldname, operator, value] of serializeFilters(conditions)) {
		dict[fieldname] = [operator, value]
	}
	return dict
}

// An unfilled row would match nothing (LIKE "%%" drops NULLs) or make get_list throw on a null.
export function isComplete(condition: any) {
	const value = condition?.value
	if (value === null || value === undefined || value === "") return false
	if (Array.isArray(value) && !value.length) return false
	return true
}

export function completeFilters(conditions: any[]) {
	return (conditions || []).filter(isComplete)
}

// serializeFilters re-wraps a `like` value's %%, so a fully-wrapped one is unwrapped here or it
// would double-wrap on re-serialize. A one-sided wildcard ("A%") is a prefix search, left alone.
export function toConditions(doctype: string, fields: any[], wire: [string, string, unknown][]) {
	return parseFilters(getFilterableFields(fields, doctype), wire)
		// parseFilters leaves `operator` undefined for a wire operator it doesn't know, which a
		// hand-written URL can carry — and the unwrap below reads it, where one TypeError in
		// setup takes the whole script down.
		.filter((c: any) => c.operator)
		.map((c: any) => {
			const value = c.value
			const wrapped =
				typeof value === "string" &&
				c.operator.includes("like") &&
				value.length > 1 &&
				value.startsWith("%") &&
				value.endsWith("%")
			return wrapped ? { ...c, value: value.slice(1, -1) } : c
		})
}

// `width` is stripped: it changes nothing the server is asked for, and at one write per mousemove
// a resize would otherwise be a refetch storm.
export function fetchKey(params: Record<string, unknown>) {
	const wire = (params.columns as { width?: unknown }[]) || []
	return JSON.stringify({ ...params, columns: wire.map(({ width, ...rest }) => rest) })
}

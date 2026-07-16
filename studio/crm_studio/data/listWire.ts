// The list controls' native shapes (FilterCondition[] / Sort[] / Column[]) turned into what
// `crm.api.doc.get_data` takes, and back again. Pure: nothing here fetches or holds state.
import { getFilterableFields, parseFilters, serializeFilters } from "@framework/ui/Filter"

// get_data's `filters` is a DICT, so one condition per field: a second on the same field
// wins. Different fields combine as AND, which is what the toolbar shows.
export function toFiltersDict(conditions: any[]) {
	const dict: Record<string, [string, unknown]> = {}
	for (const [fieldname, operator, value] of serializeFilters(conditions)) {
		dict[fieldname] = [operator, value]
	}
	return dict
}

// A row the user added but hasn't filled in is not a narrowing: sending it would match
// nothing (LIKE "%%" drops NULLs) or make get_list throw on a null value.
export function isComplete(condition: any) {
	const value = condition?.value
	if (value === null || value === undefined || value === "") return false
	if (Array.isArray(value) && !value.length) return false
	return true
}

export function completeFilters(conditions: any[]) {
	return (conditions || []).filter(isComplete)
}

// Our conditions store a `like` value bare and serializeFilters re-wraps the %%, so a
// fully-wrapped one is unwrapped here or the input would read "%A%" and double-wrap on
// re-serialize. A one-sided wildcard ("A%") is a deliberate prefix search, left alone.
export function toConditions(doctype: string, fields: any[], wire: [string, string, unknown][]) {
	return parseFilters(getFilterableFields(fields, doctype), wire)
		// parseFilters leaves `operator` undefined for a wire operator it doesn't know,
		// which a hand-written URL can carry. Dropping the row matters: the unwrap below
		// reads c.operator, and one TypeError in setup takes the whole script down.
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

// A column's `width` is stripped from the comparison: it changes nothing about what the
// server is asked for, so a drag repaints without re-hitting it — at one write per
// mousemove, that is the difference between a resize and a refetch storm.
export function fetchKey(params: Record<string, unknown>) {
	const wire = (params.columns as { width?: unknown }[]) || []
	return JSON.stringify({ ...params, columns: wire.map(({ width, ...rest }) => rest) })
}

<!--
  CrmListView — a CRM table built on frappe-ui's List MOLECULE (`frappe-ui/list`), not the
  config-driven `ListView`. The molecule is composition-first: it owns geometry (a shared column
  grid, dividers, hover surfaces, row virtualization) and leaves everything readable — cell
  contents, selection UX, resize, the footer — to the app. That is exactly the seam this CRM list
  wants, so the three things the old ListView-based wrapper had to pry open are now just... written
  here, in the open.

  Three pieces are hand-built on top of the molecule's primitives, because the molecule leaves them
  to the app on purpose:

    1. COLUMN RESIZE. The molecule has no resizer — columns are grid tracks in the public
       `--list-columns` var. So each header cell carries a drag handle that writes a live px width
       into `widthOverride` (which recomputes `--list-columns` for instant feedback) and, on
       mouseup, emits `column-resize`. The PAGE is the source of truth: it writes the width back
       into its column model, so the override is dropped on mouseup and the persisted width takes
       over — which is what keeps this in sync with ColumnSettings editing the same width.

    2. SELECTION. The molecule's own `selectable` makes a whole-row click TOGGLE the row (see
       ListRow.vue) — it never runs the row's own click. A CRM row has to OPEN on click and select
       via a checkbox, so `selectable` is not used: the checkbox is the first grid cell (its click
       is stopped so it can't open the row), row click runs `options.onRowClick`, and select-all is
       computed over the fetched rows.

    3. THE CONTROL AREA. One footer band, two modes. With no selection it shows the page-size
       buttons, the "20 of 143" readout and Load More; with a selection it reuses the same band for
       "N selected" + `bulkActions` + clear — so there is no separate select banner to reach into.

  It reaches the app bundle as a block component because it lives under
  apps/crm/studio/<studio_app>/: `studio.api.get_custom_vue_components` discovers it, and the build
  registers it with `app.component("CrmListView", ...)`. The block must carry
  `isCustomVueComponent: true` so the builder resolves it. Editing this file changes no Studio
  document, so nothing rebuilds on its own — hit Publish to regenerate the bundle.
-->
<template>
	<!-- `isolate` (isolation: isolate) is what makes the sticky header's z-10 safe: it opens a local
	     stacking context here, so z-10 only ranks the header above THIS list's rows and can't rise above
	     a page-level modal backdrop. Without it, the header stays lit through an open dialog's dim. -->
	<div class="relative isolate flex min-h-0 flex-1 flex-col">
		<!-- ONE scroller holding the header and the rows, so a title always stays over its column
		     when the table is wide enough to scroll sideways. overscroll-y-none on the VIEWPORT stops
		     the sticky header bouncing: without it, flicking the rows to the top rubber-bands the
		     scroller (macOS elastic overscroll) and the pinned header rides the bounce. It is scoped
		     to the y-axis because the bounce is vertical and this scroller also scrolls horizontally,
		     and it goes in `viewportClass` — the prop ScrollArea puts on the actual scrolling element. -->
		<ScrollArea orientation="both" viewportClass="overscroll-y-none" class="min-h-0 flex-1">
			<!-- `--list-columns` is the molecule's public grid hook; binding it inline is what makes the
			     header and every row share one live template (resize just rewrites it). `--list-row-padding-x`
			     is the molecule's content inset, flowing to both header and rows so they can't drift (see
			     the two-insets note below). w-max min-w-full: as wide as the columns need, at least the
			     viewport, so fixed columns overflow into a horizontal scroll while flex (`fr`) columns fill
			     any slack. divider="inset" starts the row divider after the checkbox track (grid-column
			     2/-1) to match the recipe — the checkbox is track 1, so the line begins at the content.
			     TWO insets, kept separate. `gutter` is the OUTER float: it pads the List horizontally so the
			     interactive rows (which are `width: 100%` with a rounded hover surface) float free of both
			     edges instead of filling the container as a flat band — and it's the same value the footer
			     insets by, so the surface and the page-size buttons share one edge. `--list-row-padding-x`
			     is the INNER inset from that surface edge to the content — end (right) only; the start (left)
			     is zeroed in <style> so the checkbox sits at the surface edge. It's set explicitly so the
			     header picks it up too (its default is 0, which would leave the header flush while padded
			     rows sit inset). -->
			<List
				divider="inset"
				:rowHeight="rowHeight"
				:style="{ '--list-columns': listColumns, '--list-row-padding-x': ROW_PADDING_X, paddingInline: gutter }"
				class="flex w-max min-w-full flex-col"
			>
				<!-- `sticky top-0` pins the header while rows scroll under it (the molecule sets rows AND
				     the header to `position: relative` in a :where() rule, so this `sticky` class wins).
				     z-10 is REQUIRED, not optional: because the rows are positioned, they paint above a
				     sticky header that has no stacking rank — that is the header/first-row overlap. A
				     z-index lifts the header over the positioned rows. The `isolate` on the root keeps this
				     rank local, so an open dialog's backdrop still dims the header (see the root comment). -->
				<ListHeader class="group sticky top-0 z-10 bg-surface-base">
					<!-- Select-all sits in the first (checkbox) track. @click.stop so it never reaches a row. -->
					<div class="flex items-center justify-center">
						<Checkbox
							:modelValue="selectAllState === 'all'"
							:indeterminate="selectAllState === 'some'"
							@update:modelValue="toggleSelectAll"
						/>
					</div>
					<ListHeaderCell
						v-for="column in columns"
						:key="column.key"
						class="relative"
						:class="alignClass(column)"
					>
						{{ column.label }}
						<!-- The resize handle lives in #suffix (a shrink-0 span, no truncate) and is absolutely
						     positioned to the cell's right edge. Drag resizes; double-click resets to auto.
						     The grab area is 8px wide but the line it draws is 1px, centered in it: the target
						     stays forgiving while the chrome stays quiet. The line only shows once the pointer
						     is anywhere over the header (`group` on ListHeader) — and stays lit through a drag,
						     because the pointer leaves the header the moment you drag down into the rows. -->
						<template #suffix>
							<span
								class="absolute inset-y-0 -right-1 flex w-2 cursor-col-resize justify-center"
								@mousedown.stop.prevent="startResize(column, $event)"
								@dblclick.stop.prevent="resetColumn(column)"
							>
								<!-- A border, not a background: `outline-*` ships only as border/outline scales,
								     so `bg-outline-*` silently generates no rule and the line stays invisible. -->
								<span
									class="border-l border-outline-gray-2 opacity-0 transition-opacity group-hover:opacity-100"
									:class="{ 'opacity-100': resizingKey === column.key }"
								/>
							</span>
						</template>
					</ListHeaderCell>
				</ListHeader>

				<!-- `virtual` windows the rows against this scroll area — only rows near the viewport mount,
				     which is what makes a 2500-row page size cheap. It needs the fixed `rowHeight` above. -->
				<ListRows
					v-if="rows.length"
					:items="rows"
					:rowKey="rowKey"
					virtual
					v-slot="{ item, value }"
				>
					<ListRow :value="value" :onClick="() => props.options.onRowClick?.(item)">
						<!-- Checkbox cell: a div (not a nested button/input) whose click is stopped so it
						     toggles selection instead of opening the row. The Checkbox is pointer-events-none,
						     so every click resolves to this wrapper. -->
						<div class="flex items-center justify-center" @click.stop.prevent="toggle(value)">
							<Checkbox
								:modelValue="selection.includes(value)"
								class="pointer-events-none"
								tabindex="-1"
								aria-hidden="true"
							/>
						</div>
						<ListCell v-for="column in columns" :key="column.key" :class="alignClass(column)">
							<Tooltip :text="props.options.showTooltip ? cellLabel(column, item) : ''">
								<div class="truncate text-base text-ink-gray-8">{{ cellLabel(column, item) }}</div>
							</Tooltip>
						</ListCell>
					</ListRow>
				</ListRows>
				<!-- Empty state: the molecule leaves this to the app, so it is drawn here from
				     `options.emptyState` ({ title, description }). -->
				<div v-else class="flex flex-col items-center gap-1 py-16 text-center">
					<span class="text-base font-medium text-ink-gray-7">
						{{ props.options.emptyState?.title ?? "No records" }}
					</span>
					<span v-if="props.options.emptyState?.description" class="text-sm text-ink-gray-5">
						{{ props.options.emptyState.description }}
					</span>
				</div>
			</List>
		</ScrollArea>

		<!-- The footer sits below the scroller (`shrink-0`) so it stays put while rows move: the page-size
		     buttons, the "20 of 143" readout, and Load More (only while more rows exist). -->
		<div
			v-if="rows.length"
			class="flex shrink-0 items-center justify-between gap-2 border-t border-outline-gray-1 py-2"
			:style="{ paddingInline: gutter }"
		>
			<!-- The page-size buttons are a RADIO GROUP, and a radio group speaks up only when the
			     selection CHANGES: after Load More at size 20 you see 60 rows with "20" still lit, and
			     clicking that lit "20" — how you ask for the first 20 back — emits nothing. A DOM click
			     fires either way, so `page-size` is emitted from the capture-phase click (the radio item
			     stops propagation, so a bubble listener out here would never hear it). -->
			<div @click.capture="onPageSizeClick">
				<TabButtons
					v-model="pageSize"
					:options="pageLengthOptions.map((size) => ({ label: String(size), value: size }))"
				/>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm text-ink-gray-5">{{ rowCount }} of {{ totalCount }}</span>
				<Button
					v-if="rowCount < totalCount"
					variant="subtle"
					label="Load More"
					@click="emit('load-more')"
				/>
			</div>
		</div>

		<!-- Selection banner: a floating pill over the list while rows are ticked. Its buttons are the
		     page's `bulkActions`; the X clears the selection (writing [] to the two-way `selection`). -->
		<Transition
			enter-active-class="duration-200 ease-out"
			enter-from-class="translate-y-2 opacity-0"
			leave-active-class="duration-200 ease-in"
			leave-to-class="translate-y-2 opacity-0"
		>
			<div v-if="selection.length" class="absolute inset-x-0 bottom-16 mx-auto w-max">
				<div
					class="flex items-center gap-3 rounded-lg bg-surface-base px-4 py-2 text-base shadow-2xl"
				>
					<Checkbox :modelValue="true" :disabled="true" />
					<span class="text-ink-gray-9">{{ selection.length }} selected</span>
					<div class="flex items-center gap-1 border-l border-outline-gray-2 ps-3">
						<Button
							v-for="action in bulkActions"
							:key="action.label"
							:label="action.label"
							:theme="action.theme"
							variant="ghost"
							@click="action.onClick(selection)"
						/>
						<Button variant="ghost" icon="lucide-x" @click="selection = []" />
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { Button, Checkbox, ScrollArea, TabButtons, Tooltip } from "frappe-ui"
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from "frappe-ui/list"
import { computed, reactive, ref } from "vue"

const props = withDefaults(
	defineProps<{
		/** Wire columns: `{ key, label, width, type, align }`. `width` is a fixed CSS size (string)
		 *  or a flexing `fr` factor (number); `align` is "left" | "right". */
		columns?: any[]
		rows?: any[]
		rowKey?: string
		options?: Record<string, any>
		/** Buttons shown in the control area while rows are selected: `{ label, theme?, onClick(names) }`. */
		bulkActions?: { label: string; theme?: string; onClick: (selection: string[]) => void }[]
		/** The outer float inset (a CSS length): the List's horizontal padding, so the rows' rounded
		 *  hover surface floats free of the container edges, and the footer insets by the same value so
		 *  its buttons line up with that surface. The content's own inset from the surface edge is a
		 *  separate, smaller `ROW_PADDING_X`. */
		gutter?: string
		/** Rows fetched so far, and rows the filter matches in all — the control area's "20 of 143". */
		rowCount?: number
		totalCount?: number
		/** The page sizes the control area offers. */
		pageLengthOptions?: number[]
		/** Fixed row height (px). Required by the molecule's row virtualization. */
		rowHeight?: number
	}>(),
	{
		columns: () => [],
		rows: () => [],
		rowKey: "name",
		options: () => ({}),
		bulkActions: () => [],
		gutter: "12px",
		rowCount: 0,
		totalCount: 0,
		pageLengthOptions: () => [20, 100, 500, 2500],
		rowHeight: 40,
	},
)

/** The selected row keys. Two-way: the page reads the selection here, and CLEARS it by writing []. */
const selection = defineModel<string[]>("selection", { default: () => [] })

/** The page size the control area is set to. Two-way, and only the CHOICE — this component never
 *  fetches, so what a new size (or a Load More) means for the query is the page's to decide. */
const pageSize = defineModel<number>("pageSize", { default: 20 })

const emit = defineEmits<{
	/** A column was dragged. `width` is a fixed px string. */
	(e: "column-resize", payload: { key: string; width: string }): void
	/** A column's handle was double-clicked: drop its fixed width so it flexes again. */
	(e: "column-reset", payload: { key: string }): void
	/** "Load More" was clicked. The page decides how many more rows that is. */
	(e: "load-more"): void
	/** A page size was CLICKED — fired even when already selected, which is how you ask for the
	 *  first N rows back after loading more. */
	(e: "page-size", size: number): void
}>()

// --- The grid template -------------------------------------------------------------------------

// A fixed leading track for the checkbox column (the molecule's own checkbox is padding, but this
// list rolls its own — see the header note above — so it needs a real track).
const CHECKBOX_TRACK = "2rem"
const MIN_COLUMN_WIDTH = 60

// Inner END (right) inset from the row's rounded hover surface to its content, so the right-aligned
// last column doesn't jam the surface corner. The START (left) is flush — zeroed in <style> below, so
// the checkbox sits at the surface edge. The OUTER float — surface edge to container — is `gutter`.
const ROW_PADDING_X = "0.5rem"

// One track per column, prefixed by the checkbox track, written to `--list-columns`. A live drag
// width in `widthOverride` wins; otherwise the column's own width (string = fixed, number = `fr`).
const listColumns = computed(() => {
	const tracks = props.columns.map(trackFor)
	// A trailing FILLER track, added only when every column is a fixed width. The row divider is a
	// grid child spanning `2 / -1`, so it stops at the last grid line — but the row's hover surface
	// is `width: 100%` and runs the full list. With only fixed tracks the columns can total less
	// than the list, and those two disagree: the divider ends mid-row while the hover reaches the
	// edge. An empty filler soaks up the slack so the last line sits at the edge and they agree.
	// Skipped when a column is already flexible, because an `fr` column consumes the slack itself —
	// a filler would just compete with it for space and shrink the real column.
	const hasFlexible = tracks.some((track) => track.includes("fr"))
	if (!hasFlexible) tracks.push("minmax(0, 1fr)")
	return [CHECKBOX_TRACK, ...tracks].join(" ")
})

function trackFor(column: any) {
	const width = widthOverride[column.key] ?? column.width
	if (width == null) return "minmax(0, 1fr)"
	return typeof width === "number" ? `${width}fr` : String(width)
}

// --- Column resize -----------------------------------------------------------------------------

// Live px widths during a drag. Cleared on mouseup so the page's persisted width takes over — which
// keeps this in sync when the width also changes from ColumnSettings (both drive the same model).
const widthOverride = reactive<Record<string, string>>({})
let drag: { key: string; startX: number; startWidth: number } | null = null

// The column being dragged, for the template — `drag` is a plain let (it is written per mousemove and
// nothing renders from it), so the handle needs its own reactive copy to keep its line lit.
const resizingKey = ref<string | null>(null)

function startResize(column: any, event: MouseEvent) {
	const cell = (event.currentTarget as HTMLElement).closest<HTMLElement>(
		"[data-slot='list-header-cell']",
	)
	if (!cell) return
	drag = { key: column.key, startX: event.clientX, startWidth: cell.getBoundingClientRect().width }
	resizingKey.value = column.key
	window.addEventListener("mousemove", onDrag)
	window.addEventListener("mouseup", endDrag)
}

function onDrag(event: MouseEvent) {
	if (!drag) return
	const width = Math.max(MIN_COLUMN_WIDTH, drag.startWidth + (event.clientX - drag.startX))
	widthOverride[drag.key] = `${Math.round(width)}px`
}

function endDrag() {
	window.removeEventListener("mousemove", onDrag)
	window.removeEventListener("mouseup", endDrag)
	resizingKey.value = null
	if (!drag) return
	const { key } = drag
	const width = widthOverride[key]
	delete widthOverride[key]
	drag = null
	if (width) emit("column-resize", { key, width })
}

function resetColumn(column: any) {
	delete widthOverride[column.key]
	emit("column-reset", { key: column.key })
}

// --- Selection ---------------------------------------------------------------------------------

// The full set of selectable row keys (the fetched rows), for select-all and its mixed state.
const allKeys = computed(() => props.rows.map((row) => String(row[props.rowKey])))

const selectAllState = computed<"none" | "some" | "all">(() => {
	const selected = allKeys.value.filter((key) => selection.value.includes(key)).length
	if (!selected) return "none"
	return selected === allKeys.value.length ? "all" : "some"
})

function toggle(value: string) {
	selection.value = selection.value.includes(value)
		? selection.value.filter((key) => key !== value)
		: [...selection.value, value]
}

function toggleSelectAll() {
	if (selectAllState.value === "all") {
		const universe = new Set(allKeys.value)
		selection.value = selection.value.filter((key) => !universe.has(key))
	} else {
		selection.value = [...new Set([...selection.value, ...allKeys.value])]
	}
}

// --- Cells -------------------------------------------------------------------------------------

// A cell's text: the row's value at the column key, or its `.label` when the value is an object.
function cellLabel(column: any, row: any) {
	const value = row[column.key]
	if (value && typeof value === "object") return value.label ?? ""
	return value ?? ""
}

function alignClass(column: any) {
	return column.align === "right" ? "justify-end" : ""
}

// --- Page size ---------------------------------------------------------------------------------

// The click can land on the radio or on anything inside it, so walk up to the radio that owns it.
// Its label IS the size, so the text is the value — guarded, since a click on the strip's padding
// hits no radio at all.
function onPageSizeClick(event: MouseEvent) {
	const item = (event.target as HTMLElement).closest("[role='radio']")
	if (!item) return
	const size = Number(item.textContent?.trim())
	if (!Number.isFinite(size) || size <= 0) return
	emit("page-size", size)
}
</script>

<style scoped>
/* The molecule draws the header's bottom border as a grid child spanning ALL tracks
   (grid-column: 1 / -1 in its own :where() rule), so it runs full-bleed under the
   checkbox track too. The row dividers are divider="inset" (2 / -1), starting after the
   checkbox track at the content. Inset the header border to the same 2 / -1 so the two
   lines share one edge — the recipe's header divider is not full. :deep reaches the
   border inside <ListHeader>, and scoped specificity beats the molecule's :where(). */
:deep([data-slot="list-header-border"]) {
	grid-column: 2 / -1;
}

/* The molecule derives BOTH the start and end content padding from the single --list-row-padding-x
   hook (ROW_PADDING_X). We want the start (left) flush so the checkbox sits at the rounded surface's
   edge, while keeping the end (right) inset — so override just padding-inline-start to 0 on the header
   and every row. :deep reaches the molecule elements; scoped specificity beats its own rules. */
:deep([data-slot="list-row"]),
:deep([data-slot="list-header"]) {
	padding-inline-start: 0;
}
</style>

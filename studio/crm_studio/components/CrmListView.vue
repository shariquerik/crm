<!--
  CrmListView — a CRM table built on frappe-ui's List MOLECULE (`frappe-ui/list`), not the
  config-driven ListView. The molecule owns geometry (the shared column grid, dividers, hover
  surfaces, virtualization) and leaves cell contents, selection, resize and the footer to the
  app — so those three are hand-built below.

  Selection is not the molecule's `selectable`: that makes a whole-row click toggle the row,
  and a CRM row has to OPEN on click and select via its checkbox instead.

  Discovered by `studio.api.get_custom_vue_components`; a block must carry
  `isCustomVueComponent: true`. Editing this file changes no Studio document — Publish to
  regenerate the bundle.
-->
<template>
	<!-- `isolate` is what makes the sticky header's z-10 safe: it opens a local stacking context,
	     so z-10 ranks the header above THIS list's rows and cannot rise above a modal backdrop. -->
	<div class="relative isolate flex min-h-0 flex-1 flex-col">
		<!-- One scroller holds the header and the rows, so a title stays over its column when the
		     table scrolls sideways. overscroll-y-none stops the sticky header riding macOS's
		     elastic bounce; it belongs on the viewport, the element that actually scrolls. -->
		<ScrollArea orientation="both" viewportClass="overscroll-y-none" class="min-h-0 flex-1">
			<!-- Two insets, kept separate. `gutter` is the OUTER float, padding the List so the rows'
			     rounded hover surface clears both edges — the footer insets by the same value, so the
			     surface and the page-size buttons share one edge. `--list-row-padding-x` is the INNER
			     inset from that surface to the content, set explicitly so the header picks it up too
			     (its default is 0, which would leave it flush while padded rows sit inset). -->
			<List
				divider="inset"
				:rowHeight="rowHeight"
				:style="{ '--list-columns': listColumns, '--list-row-padding-x': ROW_PADDING_X, paddingInline: gutter }"
				class="flex w-max min-w-full flex-col"
			>
				<!-- z-10 is REQUIRED, not optional: the molecule sets rows to `position: relative`, and
				     positioned rows paint above a sticky header with no stacking rank — that is the
				     header/first-row overlap. -->
				<ListHeader class="group sticky top-0 z-10 bg-surface-base">
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
						<!-- The grab area is 8px but the line it draws is 1px, centered: a forgiving
						     target with quiet chrome. It stays lit through a drag, because the pointer
						     leaves the header the moment you drag down into the rows. -->
						<template #suffix>
							<span
								class="absolute inset-y-0 -right-1 flex w-2 cursor-col-resize justify-center"
								@mousedown.stop.prevent="startResize(column, $event)"
								@dblclick.stop.prevent="resetColumn(column)"
							>
								<!-- A border, not a background: `outline-*` ships only as border/outline
								     scales, so `bg-outline-*` silently generates no rule. -->
								<span
									class="border-l border-outline-gray-2 opacity-0 transition-opacity group-hover:opacity-100"
									:class="{ 'opacity-100': resizingKey === column.key }"
								/>
							</span>
						</template>
					</ListHeaderCell>
				</ListHeader>

				<ListRows
					v-if="rows.length"
					:items="rows"
					:rowKey="rowKey"
					virtual
					v-slot="{ item, value }"
				>
					<ListRow :value="value" :onClick="() => props.options.onRowClick?.(item)">
						<!-- The click is stopped so it toggles selection instead of opening the row, and
						     the Checkbox is pointer-events-none so every click resolves to this wrapper. -->
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

		<div
			v-if="rows.length"
			class="flex shrink-0 items-center justify-between gap-2 border-t border-outline-gray-1 py-2"
			:style="{ paddingInline: gutter }"
		>
			<!-- The page-size buttons are a radio group, and a radio group speaks up only when the
			     selection CHANGES: after Load More at size 20 you see 60 rows with "20" still lit, and
			     clicking that lit "20" — how you ask for the first 20 back — emits nothing. A DOM click
			     fires either way, and it is taken on the capture phase because the radio item stops
			     propagation before it could bubble out here. -->
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
// frappe-ui/list's barrel imports this itself, but frappe-ui's package.json declares sideEffects
// as an array, which leaves that barrel side-effect-free — so a production build shakes the bare
// import out and ships the list with no grid rules (dev inlines the CSS, so it only breaks once
// built). Importing the stylesheet from here, where the module has known side effects, keeps it.
import "frappe-ui/list-style.css"
import { computed, reactive, ref } from "vue"

const props = withDefaults(
	defineProps<{
		/** Wire columns: `{ key, label, width, type, align }`. `width` is a fixed CSS size (string)
		 *  or a flexing `fr` factor (number); `align` is "left" | "right". */
		columns?: any[]
		rows?: any[]
		rowKey?: string
		options?: Record<string, any>
		bulkActions?: { label: string; theme?: string; onClick: (selection: string[]) => void }[]
		/** The outer float inset (a CSS length) — see the List's two-insets note. */
		gutter?: string
		/** Rows fetched so far, and rows the filter matches in all — the footer's "20 of 143". */
		rowCount?: number
		totalCount?: number
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

// Two-way: the page reads the selection here, and CLEARS it by writing [].
const selection = defineModel<string[]>("selection", { default: () => [] })

// Only the CHOICE — this component never fetches, so what a new size means for the query is the
// page's to decide.
const pageSize = defineModel<number>("pageSize", { default: 20 })

const emit = defineEmits<{
	(e: "column-resize", payload: { key: string; width: string }): void
	(e: "column-reset", payload: { key: string }): void
	(e: "load-more"): void
	/** Fired even when the size is already selected, which is how you ask for the first N rows
	 *  back after loading more. */
	(e: "page-size", size: number): void
}>()

// A real track for the checkbox column: the molecule's own checkbox is padding, but this list
// rolls its own.
const CHECKBOX_TRACK = "2rem"
const MIN_COLUMN_WIDTH = 60

// The inner END inset, so a right-aligned last column doesn't jam the surface corner. The start
// is flush — zeroed in <style> — so the checkbox sits at the surface edge.
const ROW_PADDING_X = "0.5rem"

const listColumns = computed(() => {
	const tracks = props.columns.map(trackFor)
	// A trailing FILLER, only when every column is fixed. The row divider is a grid child spanning
	// `2 / -1` and stops at the last grid line, but the hover surface is `width: 100%` and runs the
	// full list — with only fixed tracks the two disagree, and the divider ends mid-row. Skipped
	// when a column already flexes, since an `fr` soaks up the slack itself and a filler would
	// compete with it.
	const hasFlexible = tracks.some((track) => track.includes("fr"))
	if (!hasFlexible) tracks.push("minmax(0, 1fr)")
	return [CHECKBOX_TRACK, ...tracks].join(" ")
})

function trackFor(column: any) {
	const width = widthOverride[column.key] ?? column.width
	if (width == null) return "minmax(0, 1fr)"
	return typeof width === "number" ? `${width}fr` : String(width)
}

// Live px widths during a drag, cleared on mouseup so the page's persisted width takes over —
// which is what keeps this in sync when ColumnSettings edits the same width.
const widthOverride = reactive<Record<string, string>>({})
let drag: { key: string; startX: number; startWidth: number } | null = null

// `drag` is a plain let (written per mousemove, nothing renders from it), so the handle needs its
// own reactive copy to keep its line lit.
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

function cellLabel(column: any, row: any) {
	const value = row[column.key]
	if (value && typeof value === "object") return value.label ?? ""
	return value ?? ""
}

function alignClass(column: any) {
	return column.align === "right" ? "justify-end" : ""
}

// The click can land on the radio or anything inside it, so walk up to the radio that owns it.
// Its label IS the size. Guarded, since a click on the strip's padding hits no radio at all.
function onPageSizeClick(event: MouseEvent) {
	const item = (event.target as HTMLElement).closest("[role='radio']")
	if (!item) return
	const size = Number(item.textContent?.trim())
	if (!Number.isFinite(size) || size <= 0) return
	emit("page-size", size)
}
</script>

<style scoped>
/* The molecule draws the header's border as a grid child spanning ALL tracks, so it runs
   full-bleed under the checkbox track, while the row dividers start at 2 / -1. Inset the header
   border to match, so the two lines share one edge. */
:deep([data-slot="list-header-border"]) {
	grid-column: 2 / -1;
}

/* The molecule derives BOTH the start and end content padding from the single
   --list-row-padding-x hook, so the start is overridden here to sit the checkbox flush against
   the rounded surface's edge while the end stays inset. */
:deep([data-slot="list-row"]),
:deep([data-slot="list-header"]) {
	padding-inline-start: 0;
}
</style>

<!--
  CrmListView — frappe-ui's ListView with the three things a Studio BLOCK cannot reach on it.

  A block is props + events + slots, over what the component itself exposes. ListView keeps
  three things to itself, and each one is a feature the CRM list needs:

    1. RESIZE. Its header emits `columnWidthUpdated` (ListHeaderItem -> ListHeader), but
       ListView renders `<ListHeader />` with no listener and never re-emits — so
       `options.resizeColumn` alone draws a handle that resizes nothing. The fix frappe-ui
       documents (ListView/USAGE.md) is to fill ListView's DEFAULT SLOT and catch the event on
       ListHeader yourself. A block can't: Studio registers `ListView`, not `ListHeader` /
       `ListRows`. This component fills that slot, so `column-resize` becomes a real event.

    2. SELECTION. ListView emits `update:selections` but takes NO `selections` prop (it exposes
       the Set only on a template ref), so a page can read the selection and never clear it.
       Here it is a two-way `selection` prop: writing `[]` to it clears the checkboxes, which is
       what lets a page clear the selection after acting on it.

    3. THE BANNER. ListSelectBanner is rendered INSIDE ListView, so its `actions` slot is out of
       a block's reach. Rendering the banner here re-opens it: `bulkActions` puts buttons in it.

  Everything else (which columns, which rows, what a row click does, what Delete means) stays in
  the page — this component adds no CRM knowledge, it only widens the seam.

  It reaches the app bundle as a block component because it lives under
  apps/crm/studio/<studio_app>/: `studio.api.get_custom_vue_components` discovers it, and the
  build registers it with `app.component("CrmListView", ...)`. The block must carry
  `isCustomVueComponent: true` so the builder resolves it (crm-seed's blocks.custom_component).
-->
<template>
	<ListView
		ref="listRef"
		:columns="columns"
		:rows="rows"
		:rowKey="rowKey"
		:options="listOptions"
		@update:selections="onSelections"
	>
		<!-- ListView's default slot: this REPLACES its whole body, so the pieces it would have
		     rendered are rendered here — the point being that ListHeader is now ours to listen to.
		     Groups are left out on purpose: this list never groups its rows.

		     THE TABLE SCROLLS IN frappe-ui's ScrollArea, not in ListRows. ScrollArea draws an OVERLAY
		     scrollbar — a thumb that fades in on hover/scroll and reserves no gutter — where ListRows'
		     own `overflow-y-auto` gets the browser's native bar, which on a Mac set to "always show
		     scrollbars" is a permanent grey slab down the edge of the table.

		     ONE scroller, holding BOTH the header and the rows. That is the part that has to be got
		     right: a scroll box scrolls in both directions, so a header parked outside it would hold
		     still while the rows slid sideways under it, and the column titles would come away from
		     their values the moment the table was wide enough to scroll. So the header goes INSIDE,
		     and `sticky top-0` is what pins it while the rows move vertically — it still travels with
		     them horizontally, which is exactly what keeps a title over its column.

		     Nested scrollers would fight (the inner one takes the wheel, the outer thumb never moves),
		     so ListRows is stripped of its own scrolling: `!h-auto` lets it grow to its rows instead
		     of filling the viewport, `!overflow-visible` hands the overflow up to ScrollArea. It still
		     renders the rows; it just no longer owns the scroll.

		     `gutter` is the horizontal inset, and it is a MARGIN on the header and on the rows — never
		     padding on the scroll box. That is what puts the scrollbar in the far corner: the box that
		     scrolls runs full-bleed to the edge of the page, while the header and rows stop one gutter
		     short of it. Padding the scroll box instead would carry its scrollbar inward with the
		     content. (Margin on the header too, not padding: ListHeader spends its own padding on cell
		     spacing, and overriding that would slide the column titles off the row values.) -->
		<ScrollArea orientation="both" class="min-h-0 flex-1">
			<!-- w-max min-w-full: the table is as wide as its columns need, and at least as wide as the
			     viewport. It is also a plain block, which gives the sticky header a normal containing
			     block to stick in (ScrollArea's own content wrapper is a `display: table` box). -->
			<div class="flex w-max min-w-full flex-col">
				<!-- NO z-index, and that is the whole trick. `sticky` alone already makes the header a
				     positioned box, which paints above the rows (ordinary in-flow content) without one.
				     Any z-index at all, even z-[1], is too much: frappe-ui's Dialog draws its dim
				     backdrop with NO z-index of its own (`fixed inset-0 bg-black-overlay-200`) and
				     counts on being late in the DOM to cover the page. A numbered header outranks
				     that, and stays lit up across the open modal while everything around it dims. -->
				<ListHeader
					class="sticky top-0"
					:style="{ marginInline: gutter }"
					@columnWidthUpdated="onColumnWidthUpdated"
					@dblclick="onResizerDoubleClick"
				/>
				<ListRows
					v-if="rows.length"
					class="!h-auto !overflow-visible"
					:style="{ marginInline: gutter }"
				/>
				<ListEmptyState v-else />
			</div>
		</ScrollArea>
		<!-- The footer sits BELOW the scroll box and outside it (`shrink-0`), so it stays put while the
		     rows move — the counterpart of the sticky header. It is the one band here that can take
		     PADDING for its gutter rather than a margin: nothing about it scrolls, so there is no
		     scrollbar to drag inward. frappe-ui's ListFooter draws the page-size buttons, "Load More"
		     (only while rowCount < totalCount) and the "20 of 143" readout; the counts are the
		     server's, straight off the list response, and the page owns what Load More actually does. -->
		<ListFooter
			v-if="rows.length"
			v-model="pageSize"
			class="shrink-0 border-t border-outline-gray-1 py-2"
			:style="{ paddingInline: gutter }"
			:options="{ rowCount, totalCount, pageLengthOptions }"
			@loadMore="emit('load-more')"
		>
			<!-- The page-size buttons, replacing the ones ListFooter would draw itself, for the sake of
			     the click below. They are a RADIO GROUP, and a radio group only speaks up when the
			     selection CHANGES: after three Load Mores at a page size of 20 you are looking at 60
			     rows with "20" still lit, and clicking that lit "20" — the obvious way to ask for the
			     first 20 back — emits nothing at all. A DOM click fires either way, so that is what is
			     listened to, and every click reports a size, changed or not. `page-size` is therefore
			     the ONLY way a size reaches the page (the v-model above just keeps a button lit).

			     .capture, and it has to be: the radio item stops the click from propagating, so a plain
			     (bubble-phase) listener out here never hears it — verified in the browser, where a
			     capture listener on document sees the click and a bubble listener sees nothing.
			     Capture runs on the way DOWN, before the radio can swallow it. -->
			<template #left>
				<div @click.capture="onPageSizeClick">
					<TabButtons
						v-model="pageSize"
						:options="pageLengthOptions.map((size) => ({ label: String(size), value: size }))"
					/>
				</div>
			</template>
		</ListFooter>
		<ListSelectBanner>
			<template #actions="{ selections }">
				<Button
					v-for="action in bulkActions"
					:key="action.label"
					:label="action.label"
					:theme="action.theme"
					variant="ghost"
					@click="action.onClick(Array.from(selections))"
				/>
			</template>
		</ListSelectBanner>
	</ListView>
</template>

<script setup lang="ts">
import {
	Button,
	ListEmptyState,
	ListFooter,
	ListHeader,
	ListRows,
	ListSelectBanner,
	ListView,
	ScrollArea,
	TabButtons,
} from "frappe-ui"
import { computed, ref, watch } from "vue"

const props = withDefaults(
	defineProps<{
		columns?: any[]
		rows?: any[]
		rowKey?: string
		options?: Record<string, any>
		/** Buttons for the selection banner: `{ label, theme?, onClick(names) }`. */
		bulkActions?: { label: string; theme?: string; onClick: (selection: string[]) => void }[]
		/**
		 * How far the header and rows sit in from the edge, as a CSS length ("20px").
		 * The page passes its own gutter here rather than padding the block around this
		 * component, so that the scroll container stays full-bleed and its scrollbar keeps
		 * to the far edge. See the template.
		 */
		gutter?: string
		/** Rows fetched so far, and rows the filter matches in all — the footer's "20 of 143". */
		rowCount?: number
		totalCount?: number
		/** The page sizes the footer offers. */
		pageLengthOptions?: number[]
	}>(),
	{
		columns: () => [],
		rows: () => [],
		rowKey: "name",
		options: () => ({}),
		bulkActions: () => [],
		gutter: "0px",
		rowCount: 0,
		totalCount: 0,
		pageLengthOptions: () => [20, 50, 100],
	},
)

/** The selected row keys. Two-way: the page reads the selection here, and CLEARS it by writing []. */
const selection = defineModel<string[]>("selection", { default: () => [] })

/**
 * The page size the footer's buttons are set to. Two-way, and only the CHOICE — this component
 * never fetches anything, so what a new page size (or a Load More) means for the query is the
 * page's to decide.
 */
const pageSize = defineModel<number>("pageSize", { default: 20 })

const emit = defineEmits<{
	/** A column was dragged. `width` is a fixed px string. */
	(e: "column-resize", payload: { key: string; width: string }): void
	/** A column's resizer was double-clicked: drop its fixed width so it flexes again. */
	(e: "column-reset", payload: { key: string }): void
	/** "Load More" was clicked. The page decides how many more rows that is. */
	(e: "load-more"): void
	/**
	 * A page size was CLICKED — fired even when it was already the selected one, which is the
	 * whole point: that click is how you ask for the first N rows back after loading more.
	 */
	(e: "page-size", size: number): void
}>()

// The click can land on the radio or on anything inside it, so walk up to the radio that owns it.
// Its label IS the size (that is what `options` above puts there), so the text is the value —
// guarded anyway, since a click on the strip's padding hits no radio at all.
function onPageSizeClick(event: MouseEvent) {
	const item = (event.target as HTMLElement).closest("[role='radio']")
	if (!item) return
	const size = Number(item.textContent?.trim())
	if (!Number.isFinite(size) || size <= 0) return
	emit("page-size", size)
}

const listRef = ref<any>(null)

// Both are non-negotiable for what this component adds: without `selectable` there are no
// checkboxes to select with, and without `resizeColumn` frappe-ui draws no drag handle to
// listen to. Everything else (emptyState, onRowClick, showTooltip) is the page's to pass.
const listOptions = computed(() => ({ ...props.options, selectable: true, resizeColumn: true }))

function onSelections(selections: Set<string>) {
	selection.value = Array.from(selections)
}

// The page clears the selection by writing [] — ListView owns the Set, so the only way to move
// it is the toggleAllRows it exposes. Guarded on size, or clearing on an already-empty
// selection would re-emit and loop.
watch(selection, (value) => {
	if (!value.length && listRef.value?.selections?.size) listRef.value.toggleAllRows(false)
})

function onColumnWidthUpdated(event: { key: string; width: string }) {
	emit("column-resize", event)
}

// frappe-ui binds the drag to the resizer's `mousedown` and exposes no dblclick on it, so the
// reset gesture is delegated on the header grid: find the double-clicked resizer, map its
// position to a column (the header draws one resizer per column, in order), and let the page
// return that column to auto width. This mirrors @framework/ui's own ListView story.
function onResizerDoubleClick(event: MouseEvent) {
	const resizer = (event.target as HTMLElement).closest(".cursor-col-resize")
	const header = resizer?.closest(".grid")
	if (!resizer || !header) return
	const index = Array.from(header.querySelectorAll(".cursor-col-resize")).indexOf(resizer)
	const column = props.columns[index]
	if (column) emit("column-reset", { key: column.key })
}
</script>

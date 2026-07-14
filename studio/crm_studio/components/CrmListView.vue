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
		     Groups are left out on purpose: this list never groups its rows. -->
		<ListHeader @columnWidthUpdated="onColumnWidthUpdated" @dblclick="onResizerDoubleClick" />
		<ListRows v-if="rows.length" />
		<ListEmptyState v-else />
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
import { Button, ListEmptyState, ListHeader, ListRows, ListSelectBanner, ListView } from "frappe-ui"
import { computed, ref, watch } from "vue"

const props = withDefaults(
	defineProps<{
		columns?: any[]
		rows?: any[]
		rowKey?: string
		options?: Record<string, any>
		/** Buttons for the selection banner: `{ label, theme?, onClick(names) }`. */
		bulkActions?: { label: string; theme?: string; onClick: (selection: string[]) => void }[]
	}>(),
	{ columns: () => [], rows: () => [], rowKey: "name", options: () => ({}), bulkActions: () => [] },
)

/** The selected row keys. Two-way: the page reads the selection here, and CLEARS it by writing []. */
const selection = defineModel<string[]>("selection", { default: () => [] })

const emit = defineEmits<{
	/** A column was dragged. `width` is a fixed px string. */
	(e: "column-resize", payload: { key: string; width: string }): void
	/** A column's resizer was double-clicked: drop its fixed width so it flexes again. */
	(e: "column-reset", payload: { key: string }): void
}>()

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

<template>
	<div class="relative isolate flex min-h-0 flex-1 flex-col">
		<ScrollArea orientation="both" viewportClass="overscroll-y-none" class="min-h-0 flex-1">
			<List
				divider="inset"
				:rowHeight="rowHeight"
				:style="{ '--list-columns': listColumns, '--list-row-padding-x': ROW_PADDING_X, paddingInline: gutter }"
				class="flex w-max min-w-full flex-col"
			>
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
						<template #suffix>
							<span
								class="absolute inset-y-0 -right-1 flex w-2 cursor-col-resize justify-center"
								@mousedown.stop.prevent="startResize(column, $event)"
								@dblclick.stop.prevent="resetColumn(column)"
							>
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
import "frappe-ui/list-style.css"
import { computed, reactive, ref } from "vue"

const props = withDefaults(
	defineProps<{
		columns?: any[]
		rows?: any[]
		rowKey?: string
		options?: Record<string, any>
		bulkActions?: { label: string; theme?: string; onClick: (selection: string[]) => void }[]
		gutter?: string
		rowCount?: number
		totalCount?: number
		pageLengthOptions?: number[]
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

const selection = defineModel<string[]>("selection", { default: () => [] })

const pageSize = defineModel<number>("pageSize", { default: 20 })

const emit = defineEmits<{
	(e: "column-resize", payload: { key: string; width: string }): void
	(e: "column-reset", payload: { key: string }): void
	(e: "load-more"): void
	(e: "page-size", size: number): void
}>()

const CHECKBOX_TRACK = "2rem"
const MIN_COLUMN_WIDTH = 60

const ROW_PADDING_X = "0.5rem"

const listColumns = computed(() => {
	const tracks = props.columns.map(trackFor)
	const hasFlexible = tracks.some((track) => track.includes("fr"))
	if (!hasFlexible) tracks.push("minmax(0, 1fr)")
	return [CHECKBOX_TRACK, ...tracks].join(" ")
})

function trackFor(column: any) {
	const width = widthOverride[column.key] ?? column.width
	if (width == null) return "minmax(0, 1fr)"
	return typeof width === "number" ? `${width}fr` : String(width)
}

const widthOverride = reactive<Record<string, string>>({})
let drag: { key: string; startX: number; startWidth: number } | null = null

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

function onPageSizeClick(event: MouseEvent) {
	const item = (event.target as HTMLElement).closest("[role='radio']")
	if (!item) return
	const size = Number(item.textContent?.trim())
	if (!Number.isFinite(size) || size <= 0) return
	emit("page-size", size)
}
</script>

<style scoped>
:deep([data-slot="list-header-border"]) {
	grid-column: 2 / -1;
}

:deep([data-slot="list-row"]),
:deep([data-slot="list-header"]) {
	padding-inline-start: 0;
}
</style>

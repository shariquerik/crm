<template>
  <div class="relative isolate flex min-h-0 flex-1 flex-col">
    <ScrollArea
      orientation="both"
      viewportClass="overscroll-y-none"
      class="min-h-0 flex-1"
    >
      <List
        divider="inset"
        :rowHeight="rowHeight"
        :style="{
          '--list-columns': listColumns,
          '--list-row-padding-x': ROW_PADDING_X,
          paddingInline: gutter,
        }"
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
          v-slot="{ item, value }"
          :items="rows"
          :rowKey="rowKey"
          virtual
        >
          <ListRow
            :value="value"
            :onClick="() => props.options.onRowClick?.(item)"
          >
            <div
              class="flex items-center justify-center"
              @click.stop.prevent="toggle(value)"
            >
              <Checkbox
                :modelValue="selection.includes(value)"
                class="pointer-events-none"
                tabindex="-1"
                aria-hidden="true"
              />
            </div>
            <ListCell
              v-for="column in columns"
              :key="column.key"
              :class="alignClass(column)"
            >
              <Tooltip
                :text="props.options.showTooltip ? cellLabel(column, item) : ''"
              >
                <div class="truncate text-base text-ink-gray-8">
                  {{ cellLabel(column, item) }}
                </div>
              </Tooltip>
            </ListCell>
          </ListRow>
        </ListRows>
        <template v-else-if="loading">
          <ListRow v-for="index in SKELETON_ROW_COUNT" :key="index">
            <div />
            <ListCell v-for="column in skeletonColumns" :key="column.key">
              <Skeleton class="h-3 w-full rounded" />
            </ListCell>
          </ListRow>
        </template>
        <div v-else class="flex flex-col items-center gap-1 py-16 text-center">
          <span class="text-base font-medium text-ink-gray-7">
            {{ props.options.emptyState?.title ?? 'No records' }}
          </span>
          <span
            v-if="props.options.emptyState?.description"
            class="text-sm text-ink-gray-5"
          >
            {{ props.options.emptyState.description }}
          </span>
        </div>
      </List>
    </ScrollArea>

    <CrmListFooter
      v-if="rows.length || loading"
      v-model:pageSize="pageSize"
      :rowCount="rowCount"
      :totalCount="totalCount"
      :hasLiveCounts="hasLiveCounts"
      :pageLengthOptions="pageLengthOptions"
      :gutter="gutter"
      @load-more="emit('load-more')"
      @page-size="emit('page-size', $event)"
    />

    <CrmListBulkBar v-model:selection="selection" :actions="bulkActions" />
  </div>
</template>

<script setup lang="ts">
import { Checkbox, ScrollArea, Skeleton, Tooltip } from 'frappe-ui'
import {
  List,
  ListCell,
  ListHeader,
  ListHeaderCell,
  ListRow,
  ListRows,
} from 'frappe-ui/list'
import 'frappe-ui/list-style.css'
import { computed, toRef, watch } from 'vue'

import CrmListBulkBar from '@app/components/CrmListBulkBar.vue'
import CrmListFooter from '@app/components/CrmListFooter.vue'
import { useColumnResize } from '@app/composables/useColumnResize'
import { useListSnapshot } from '@app/composables/useListSnapshot'
import { useRowSelection } from '@app/composables/useRowSelection'

const props = withDefaults(
  defineProps<{
    columns?: any[]
    rows?: any[]
    rowKey?: string
    options?: Record<string, any>
    bulkActions?: {
      label: string
      theme?: string
      onClick: (selection: string[]) => void
    }[]
    gutter?: string
    rowCount?: number
    totalCount?: number
    pageLengthOptions?: number[]
    rowHeight?: number
    loading?: boolean
    cacheKey?: string
  }>(),
  {
    columns: () => [],
    rows: () => [],
    rowKey: 'name',
    options: () => ({}),
    bulkActions: () => [],
    gutter: '12px',
    rowCount: 0,
    totalCount: 0,
    pageLengthOptions: () => [20, 100, 500, 2500],
    rowHeight: 40,
    loading: false,
    cacheKey: '',
  },
)

const selection = defineModel<string[]>('selection', { default: () => [] })

const pageSize = defineModel<number>('pageSize', { default: 20 })

const emit = defineEmits<{
  (e: 'column-resize', payload: { key: string; width: string }): void
  (e: 'column-reset', payload: { key: string }): void
  (e: 'load-more'): void
  (e: 'page-size', size: number): void
}>()

const ROW_PADDING_X = '0.5rem'

const SKELETON_ROW_COUNT = 10
const SKELETON_COLUMN_COUNT = 4

const { rows, columns, hasLiveCounts } = useListSnapshot(props)

const { selectAllState, toggle, toggleSelectAll } = useRowSelection({
  selection,
  rows,
  rowKey: toRef(props, 'rowKey'),
})

// Column metadata is a request behind `loading`; without stand-in columns the skeleton
// rows have no cells and the list reads as blank.
const skeletonColumns = computed(() => {
  if (columns.value.length) return columns.value
  return Array.from({ length: SKELETON_COLUMN_COUNT }, (_, index) => ({
    key: `skeleton-${index}`,
  }))
})

const trackedColumns = computed(() =>
  props.loading ? skeletonColumns.value : columns.value,
)

const { listColumns, resizingKey, startResize, resetColumn } = useColumnResize({
  columns: trackedColumns,
  emit,
})

watch(
  () => props.cacheKey,
  () => {
    selection.value = []
  },
)

function cellLabel(column: any, row: any) {
  const value = row[column.key]
  if (value && typeof value === 'object') return value.label ?? ''
  return value ?? ''
}

function alignClass(column: any) {
  return column.align === 'right' ? 'justify-end' : ''
}
</script>

<style scoped>
:deep([data-slot='list-header-border']) {
  grid-column: 2 / -1;
}

:deep([data-slot='list-row']),
:deep([data-slot='list-header']) {
  padding-inline-start: 0;
}
</style>

<template>
  <div
    class="flex shrink-0 items-center justify-between gap-2 border-t border-outline-gray-1 py-2 px-5"
  >
    <div class="flex items-center gap-2">
      <div @click.capture="onPageSizeClick">
        <TabButtons
          v-model="pageSize"
          :options="
            pageLengthOptions.map((size) => ({
              label: String(size),
              value: size,
            }))
          "
        />
      </div>
      <Button
        v-if="hasCounts && rowCount < totalCount"
        variant="subtle"
        label="Load More"
        @click="emit('load-more')"
      />
    </div>
    <div class="flex items-center gap-2">
      <span v-if="hasCounts" class="text-sm text-ink-gray-5"
        >{{ rowCount }} of {{ totalCount }}</span
      >
      <Skeleton v-else class="h-3 w-16 rounded" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button, Skeleton, TabButtons } from 'frappe-ui'

withDefaults(
  defineProps<{
    rowCount?: number
    totalCount?: number
    hasCounts?: boolean
    pageLengthOptions?: number[]
  }>(),
  {
    rowCount: 0,
    totalCount: 0,
    hasCounts: false,
    pageLengthOptions: () => [20, 100, 500, 2500],
  },
)

const pageSize = defineModel<number>('pageSize', { default: 20 })

const emit = defineEmits<{
  (e: 'load-more'): void
  (e: 'page-size', size: number): void
}>()

function onPageSizeClick(event: MouseEvent) {
  const item = (event.target as HTMLElement).closest("[role='radio']")
  if (!item) return
  const size = Number(item.textContent?.trim())
  if (!Number.isFinite(size) || size <= 0) return
  emit('page-size', size)
}
</script>

<!-- The whole form, as a tab: the panel's overflow surface. -->
<template>
  <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto">
    <FormLayout
      v-if="layout.length"
      v-model:doc="doc"
      :layout="layout"
      :class="formClasses"
    />

    <!-- Mirrors the form's section band so the swap to real fields doesn't shift the page. -->
    <div v-else class="mx-auto w-full max-w-3xl p-6">
      <Skeleton class="h-4 w-24 rounded" />
      <div class="mt-6 grid grid-cols-2 gap-x-10 gap-y-6">
        <div v-for="index in 8" :key="index" class="flex flex-col gap-2">
          <Skeleton class="h-3 w-20 rounded" />
          <Skeleton class="h-7 w-full rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Skeleton } from 'frappe-ui'
import { FormLayout } from '@framework/ui/components/FormLayout'

import { useScrollRestore } from '@/composables/usePageState'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const formClasses = [
  '!rounded-none !border-0',
  "[&_[role='tablist']]:sticky [&_[role='tablist']]:top-0 [&_[role='tablist']]:z-10 [&_[role='tablist']]:bg-surface-base",
  '[&_.sections]:mx-auto [&_.sections]:my-0 [&_.sections]:w-full [&_.sections]:max-w-3xl [&_.sections]:p-6',
  '[&_.section-header]:!px-0 [&_.section-body]:!px-0',
]

const scroller = ref<HTMLElement | null>(null)

useScrollRestore(
  scroller,
  () => props.layout.length > 0 && Boolean(doc.value?.name),
  `scroll:${props.item.name}`,
)
</script>

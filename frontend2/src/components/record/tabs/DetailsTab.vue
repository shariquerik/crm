<!-- The whole form, as a tab: the panel's overflow surface. -->
<template>
  <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto p-6">
    <FormLayout v-if="layout.length" v-model:doc="doc" :layout="layout" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FormLayout } from '@framework/ui/components/FormLayout'

import { useScrollRestore } from '@/composables/usePageState'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const scroller = ref<HTMLElement | null>(null)

useScrollRestore(
  scroller,
  () => props.layout.length > 0 && Boolean(doc.value?.name),
  `scroll:${props.item.name}`,
)
</script>

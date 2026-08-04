<!-- The tab strip and the one tab under it. -->
<template>
  <Tabs v-model="tabIndex" as="div" :tabs="tabs">
    <template #tab-panel>
      <component
        :is="resolveTab(current.type)"
        :key="current.name"
        v-model:doc="doc"
        :item="current"
        :doctype="doctype"
        :docname="docname"
        :docinfo="docinfo"
        :layout="layout"
      />
    </template>
  </Tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Tabs } from 'frappe-ui'

import { activeTab, useRecordLayout } from '@/data/recordLayout'
import { resolveTab, type TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc' | 'item'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const route = useRoute()
const router = useRouter()

const { tabs } = useRecordLayout(() => props.doctype)

const current = computed(() =>
  activeTab(tabs.value, route.query.tab as string | undefined),
)

const tabIndex = computed({
  get: () => tabs.value.indexOf(current.value),
  set: (index: number) => {
    router.replace({ query: { ...route.query, tab: tabs.value[index].name } })
  },
})
</script>

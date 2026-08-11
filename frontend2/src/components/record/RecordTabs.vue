<!-- The tab strip and the one tab under it. -->
<template>
  <Tabs v-if="tabs.length" v-model="tabIndex" as="div" :tabs="tabs">
    <template #tab-panel>
      <!-- A scripted tab mounts with `page` plus its author's props; a built-in
           keeps the host's own contract. -->
      <component
        :is="current.component"
        v-if="current.component"
        :key="current.name"
        :page="controller?.page"
        v-bind="scriptProps(current)"
      />
      <component
        :is="resolveTab(current.type)"
        v-else
        :key="current.name"
        v-model:doc="doc"
        :item="current"
        :doctype="doctype"
        :docname="docname"
        :docinfo="docinfo"
        :feeds="feeds"
        :layout="layout"
      />
    </template>
  </Tabs>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Tabs } from 'frappe-ui'
import type { TabItem } from '@framework/ui/experimental'

import { RecordPageKey } from '@/data/pageContext'
import { activeTab, useRecordLayout } from '@/data/recordLayout'
import { resolveTab, type TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc' | 'item'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const route = useRoute()
const router = useRouter()

const { tabs: builtinTabs } = useRecordLayout(() => props.doctype)

const controller = inject(RecordPageKey, null)
controller?.tabs.provideBuiltins(() => builtinTabs.value as any[])

// Held back until the first replay: rendering built-ins first would restructure
// the strip on screen when scripted tabs splice in.
const tabs = computed<any[]>(() => {
  if (!controller) return builtinTabs.value
  return controller.ready.value ? controller.tabs.visible() : []
})

const current = computed(() =>
  activeTab(tabs.value as any[], route.query.tab as string | undefined),
)

/** The author's props, v-bound beside the host's; `page` is not theirs to claim. */
function scriptProps(item: TabItem) {
  const { page: _claimed, ...rest } = item.props ?? {}
  return rest
}

const tabIndex = computed({
  get: () => tabs.value.indexOf(current.value),
  set: (index: number) => {
    router.replace({ query: { ...route.query, tab: tabs.value[index].name } })
  },
})
</script>

<style scoped>
/* The panel is flex-col with no grow, so a feed shorter than the page would leave
   the composer band floating under the last row instead of at the bottom. */
:deep([role='tabpanel'][data-state='active']) {
  flex: 1 1 0%;
  min-height: 0;
}
</style>

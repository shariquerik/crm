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

  <!-- Mirrors the strip's own metrics so the swap to real tabs doesn't shift the page. -->
  <div v-else class="flex flex-1 flex-col overflow-hidden">
    <div class="flex items-center gap-5 border-b p-1 px-5">
      <Skeleton
        v-for="index in 4"
        :key="index"
        class="my-2.5 h-4 w-16 rounded"
      />
    </div>
    <div class="px-6 pt-4">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <template v-for="(row, index) in FEED_SKELETON" :key="index">
          <div v-if="row.kind === 'change'" class="flex items-center gap-3">
            <Skeleton class="size-5 shrink-0 rounded-full" />
            <Skeleton class="h-3 rounded" :class="row.width" />
          </div>
          <div v-else class="flex items-start gap-3">
            <Skeleton class="size-8 shrink-0 rounded-full" />
            <div class="flex w-full flex-col gap-2">
              <Skeleton class="h-3 w-1/4 rounded" />
              <Skeleton v-if="row.kind === 'email'" class="h-3 w-1/3 rounded" />
              <Skeleton
                class="w-full rounded-lg"
                :class="row.kind === 'email' ? 'h-24' : 'h-16'"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="mt-auto px-6 pb-4">
      <div class="mx-auto w-full max-w-3xl">
        <Skeleton class="h-10 w-full rounded-lg" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Skeleton, Tabs } from 'frappe-ui'
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

/** The loading feed: the shapes of a record change, a comment and an email. */
const FEED_SKELETON = [
  { kind: 'change', width: 'w-2/5' },
  { kind: 'change', width: 'w-1/2' },
  { kind: 'comment' },
  { kind: 'change', width: 'w-1/3' },
  { kind: 'email' },
  { kind: 'change', width: 'w-3/5' },
  { kind: 'comment' },
] as { kind: string; width?: string }[]

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

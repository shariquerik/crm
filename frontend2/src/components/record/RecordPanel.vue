<!-- The record's right-hand column: every field, resizable and collapsible to a rail. -->
<template>
  <PanelEdge
    v-model:width="width"
    v-model:dragging="dragging"
    :open="!collapsed"
    @toggle="collapsed = !collapsed"
  />

  <aside
    class="flex shrink-0 flex-col overflow-hidden border-l border-outline-gray-1"
    :class="dragging ? '' : 'transition-[width] duration-300 ease-in-out'"
    :style="{ width: `${collapsed ? RAIL_WIDTH : width}px` }"
  >
    <div v-if="collapsed" class="flex flex-col items-center py-3">
      <div v-if="!doc.name" class="flex flex-col items-center gap-1">
        <Skeleton v-for="action in 6" :key="action" class="size-7 rounded" />
      </div>
      <RecordActions
        v-else
        vertical
        :doctype="doctype"
        :docname="docname"
        :chrome="chrome"
      />
    </div>

    <div
      v-else
      class="relative flex h-full min-h-0 flex-col"
      :style="{ width: `${width}px` }"
    >
      <RecordIdentity
        v-model:doc="doc"
        :doctype="doctype"
        :docname="docname"
        :chrome="chrome"
        @share="sharing = true"
      />

      <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto">
        <div ref="content">
          <PanelLayout
            v-if="layout.length"
            v-model:doc="doc"
            v-model:openSections="openSections"
            :layout="layout"
            :surface="controller?.panelSections"
            :page="controller?.page"
            @expand="expand"
          />

          <!-- Mirrors PanelSection's header and row grid so real fields land without a shift. -->
          <template v-else>
            <div v-for="section in 3" :key="section" class="px-4">
              <Skeleton class="my-2 h-4 w-24 rounded" />
              <div class="flex flex-col gap-2.5 pb-3 pt-2.5">
                <div
                  v-for="row in 4"
                  :key="row"
                  class="grid grid-cols-[130px_1fr] items-center gap-2"
                >
                  <Skeleton class="h-3 w-20 rounded" />
                  <Skeleton class="mx-1.5 h-3 w-2/3 rounded" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-base to-transparent transition-opacity"
        :class="atBottom ? 'opacity-0' : 'opacity-100'"
      />
    </div>
  </aside>

  <ShareDialog
    v-model="sharing"
    :shared="chrome.shared"
    @share="chrome.share"
    @unshare="chrome.unshare"
  />
</template>

<script setup lang="ts">
import { inject, nextTick, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Skeleton } from 'frappe-ui'
import { PanelLayout } from '@framework/ui/experimental'
import type {
  FieldNode,
  FormLayoutSchema,
} from '@framework/ui/components/FormLayout'

import PanelEdge from '@/components/record/PanelEdge.vue'
import RecordActions from '@/components/record/RecordActions.vue'
import RecordIdentity from '@/components/record/RecordIdentity.vue'
import ShareDialog from '@/components/record/ShareDialog.vue'
import type { RecordChrome } from '@/data/docinfo'
import { RecordPageKey } from '@/data/pageContext'
import { DETAILS_TAB } from '@/data/recordLayout'
import { RAIL_WIDTH, usePanelState } from '@/composables/usePanelState'
import { useScrollEdges } from '@/composables/useScrollEdges'

const props = defineProps<{
  doctype: string
  docname: string
  chrome: RecordChrome
  layout: FormLayoutSchema
}>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const route = useRoute()
const router = useRouter()

const controller = inject(RecordPageKey, null)

const { width, collapsed, openSections } = usePanelState(
  props.doctype,
  () => props.layout,
)
const dragging = ref(false)
const sharing = ref(false)

const scroller = useTemplateRef<HTMLElement>('scroller')
const content = useTemplateRef<HTMLElement>('content')
const { atBottom } = useScrollEdges(scroller, content)

/** A fieldtype with no honest panel row opens in the full form instead. */
async function expand(field: FieldNode) {
  await router.replace({ query: { ...route.query, tab: DETAILS_TAB } })
  await nextTick()
  fieldRow(field.fieldname)?.scrollIntoView({ block: 'center' })
}

// The panel's own rows carry the same attribute, so the search stays inside the open tab.
function fieldRow(fieldname: string) {
  return document.querySelector<HTMLElement>(
    `[role='tabpanel'][data-state='active'] [data-fieldname='${fieldname}']`,
  )
}
</script>

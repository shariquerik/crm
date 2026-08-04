<!-- PROTOTYPE — throwaway. The record page of ANY doctype, mocked as a plain Contact: a
     timeline whose tabs include the full form, beside a panel holding every field. -->
<template>
  <GenericHeader />

  <!-- isolate: the page's z-10/z-20 layers beat a dialog overlay's z-index:auto otherwise,
       and stay lit while the rest of the page dims. -->
  <div class="isolate flex min-h-0 flex-1">
    <GenericTimeline v-model:tab="tab" with-form />

    <PanelEdge
      v-model:width="panelWidth"
      v-model:dragging="dragging"
      :open="panelOpen"
      @toggle="panelOpen = !panelOpen"
    />

    <aside
      class="flex shrink-0 flex-col overflow-hidden border-l border-outline-gray-1"
      :class="dragging ? '' : 'transition-[width] duration-300 ease-in-out'"
      :style="{ width: `${panelOpen ? panelWidth : RAIL_WIDTH}px` }"
    >
      <div
        v-if="panelOpen"
        class="flex h-full flex-col"
        :style="{ width: `${panelWidth}px` }"
      >
        <RecordIdentity />

        <div class="relative min-h-0 flex-1">
          <div ref="panel" class="h-full overflow-y-auto">
            <div ref="panelContent">
              <PanelFieldSection
                v-for="(section, index) in formSections"
                :key="section.label"
                :label="section.label"
                :fields="section.fields"
                :index="index"
                :open="opened.has(index)"
                @toggle="toggle(index)"
              >
                <template v-if="index === 0" #header-action>
                  <Tooltip text="Show all details">
                    <Button
                      icon="lucide-table-properties"
                      variant="ghost"
                      @click="tab = 'details'"
                    />
                  </Tooltip>
                </template>
              </PanelFieldSection>
            </div>
          </div>

          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-base to-transparent transition-opacity"
            :class="atBottom ? 'opacity-0' : 'opacity-100'"
          />
        </div>
      </div>

      <div
        v-else
        class="flex w-12 shrink-0 flex-col items-center gap-1 px-2 py-3"
      >
        <RecordActions vertical />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { Button, Tooltip } from 'frappe-ui'

import GenericHeader from './GenericHeader.vue'
import GenericTimeline from './GenericTimeline.vue'
import PanelEdge from './PanelEdge.vue'
import PanelFieldSection from './PanelFieldSection.vue'
import RecordActions from './RecordActions.vue'
import RecordIdentity from './RecordIdentity.vue'
import { formSections } from './genericMock'
import { useScrollEdges } from './useScrollEdges'

const RAIL_WIDTH = 48

const panel = useTemplateRef<HTMLElement>('panel')
const panelContent = useTemplateRef<HTMLElement>('panelContent')
const { atBottom } = useScrollEdges(panel, panelContent)

const tab = ref('activity')
const panelOpen = ref(true)
const panelWidth = ref(380)
const dragging = ref(false)
const opened = ref(new Set([0, 1]))

function toggle(index: number) {
  const next = new Set(opened.value)
  if (!next.delete(index)) next.add(index)
  opened.value = next
}
</script>

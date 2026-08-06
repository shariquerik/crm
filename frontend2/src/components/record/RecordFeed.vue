<!-- The scroller every feed tab fills: a centred column, both edge fades, and the band
     holding the composer and the one scroll button. -->
<template>
  <div class="relative min-h-0 flex-1">
    <!-- The band floats over the scroller, so its height becomes the bottom padding —
         without it a resized composer hides the last activities.
         `isolate` keeps the timeline's own z-indices (the gutter icons sit above their
         connector line) from rising over the fades below. -->
    <div
      ref="scroller"
      class="isolate h-full overflow-y-auto px-6 pt-4"
      :style="{ paddingBottom: `${bandHeight + 32}px` }"
    >
      <div ref="content" class="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <slot />
      </div>
    </div>

    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface-base to-transparent transition-opacity"
      :class="atTop ? 'opacity-0' : 'opacity-100'"
    />
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-base from-40% to-transparent transition-opacity"
      :class="atBottom ? 'opacity-0' : 'opacity-100'"
    />

    <div
      ref="band"
      class="pointer-events-none absolute inset-x-0 bottom-4 z-10 px-6"
    >
      <div class="relative mx-auto w-full max-w-3xl">
        <RecordComposer
          :doctype="doctype"
          :docname="docname"
          :doc="doc"
          :layout="layout"
        />

        <!-- The button floats off the composer instead of sharing a flex row with it: as a
             sibling it kept a floor under the row, shrinking it off the timeline's column. -->
        <div
          v-if="overflowing"
          class="absolute"
          :class="
            besideComposer
              ? 'bottom-1 left-full ml-2'
              : 'bottom-full right-0 mb-2'
          "
        >
          <Tooltip
            :text="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
            placement="top"
          >
            <Button
              class="pointer-events-auto shadow-md !bg-surface-elevation-2"
              variant="ghost"
              :icon="pastHalf ? 'lucide-arrow-up' : 'lucide-arrow-down'"
              :aria-label="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
              @click="scrollTo(pastHalf ? 0 : scroller?.scrollHeight)"
            />
          </Tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Button, Tooltip } from 'frappe-ui'
import RecordComposer from '@/components/record/composer/RecordComposer.vue'
import { useScrollEdges } from '@/composables/useScrollEdges'
import { useScrollRestore } from '@/composables/usePageState'
import type { TabProps } from '@/data/tabTypes'

/** The tab's own props, so the feed keeps its offset and the band knows the record. */
const props = defineProps<TabProps & { ready: boolean }>()

const scroller = useTemplateRef<HTMLElement>('scroller')
const content = useTemplateRef<HTMLElement>('content')
const band = useTemplateRef<HTMLElement>('band')

const { width: bandWidth, height: bandHeight } = useElementSize(band)

/** `max-w-3xl` on the composer column, and the room the scroll button needs next to it. */
const composerWidth = 768
const buttonWidth = 36

const besideComposer = computed(
  () => bandWidth.value - composerWidth >= buttonWidth * 2,
)

const { atTop, atBottom, overflowing, pastHalf } = useScrollEdges(
  scroller,
  content,
)

useScrollRestore(scroller, () => props.ready, `scroll:${props.item.name}`)

function scrollTo(top = 0) {
  scroller.value?.scrollTo({ top, behavior: 'smooth' })
}
</script>

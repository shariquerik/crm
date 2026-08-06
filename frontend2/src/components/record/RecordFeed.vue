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
      class="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-end gap-2 px-6"
    >
      <div class="flex-1" />

      <RecordComposer
        class="min-w-0"
        :doctype="doctype"
        :docname="docname"
        :doc="doc"
        :layout="layout"
      />

      <div class="flex flex-1 justify-end">
        <Tooltip
          v-if="overflowing"
          :text="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
          placement="top"
        >
          <button
            type="button"
            class="pointer-events-auto grid size-9 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2"
            :aria-label="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
            @click="scrollTo(pastHalf ? 0 : scroller?.scrollHeight)"
          >
            <span
              class="size-4"
              :class="pastHalf ? 'lucide-arrow-up' : 'lucide-arrow-down'"
              aria-hidden="true"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Tooltip } from 'frappe-ui'
import RecordComposer from '@/components/record/composer/RecordComposer.vue'
import { useScrollEdges } from '@/composables/useScrollEdges'
import { useScrollRestore } from '@/composables/usePageState'
import type { TabProps } from '@/data/tabTypes'

/** The tab's own props, so the feed keeps its offset and the band knows the record. */
const props = defineProps<TabProps & { ready: boolean }>()

const scroller = useTemplateRef<HTMLElement>('scroller')
const content = useTemplateRef<HTMLElement>('content')
const band = useTemplateRef<HTMLElement>('band')

const { height: bandHeight } = useElementSize(band)

const { atTop, atBottom, overflowing, pastHalf } = useScrollEdges(
  scroller,
  content,
)

useScrollRestore(scroller, () => props.ready, `scroll:${props.item.name}`)

function scrollTo(top = 0) {
  scroller.value?.scrollTo({ top, behavior: 'smooth' })
}
</script>

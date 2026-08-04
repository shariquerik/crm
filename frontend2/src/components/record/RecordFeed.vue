<!-- The scroller every feed tab fills: a centred column, both edge fades, one scroll button. -->
<template>
  <div class="relative min-h-0 flex-1">
    <div ref="scroller" class="h-full overflow-y-auto px-6 pb-16 pt-4">
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

    <div v-if="overflowing" class="absolute bottom-4 right-6 z-10">
      <Tooltip
        :text="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
        placement="top"
      >
        <button
          type="button"
          class="grid size-9 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2"
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
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Tooltip } from 'frappe-ui'

import { useScrollEdges } from '@/composables/useScrollEdges'
import { useScrollRestore } from '@/composables/usePageState'

/** `name` is the tab's, so each feed keeps its own offset in page state. */
const props = defineProps<{ name: string; ready: boolean }>()

const scroller = useTemplateRef<HTMLElement>('scroller')
const content = useTemplateRef<HTMLElement>('content')

const { atTop, atBottom, overflowing, pastHalf } = useScrollEdges(
  scroller,
  content,
)

useScrollRestore(scroller, () => props.ready, `scroll:${props.name}`)

function scrollTo(top = 0) {
  scroller.value?.scrollTo({ top, behavior: 'smooth' })
}
</script>

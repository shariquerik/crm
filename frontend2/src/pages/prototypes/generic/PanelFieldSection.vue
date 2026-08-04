<!-- PROTOTYPE — throwaway. One collapsible field group in the side panel. Header and
     fields are siblings, not a wrapping <section>: a sticky header cannot outlive its own
     containing block, and a section box would end at the section, unpinning the header. -->
<template>
  <div
    class="group/section sticky flex cursor-pointer select-none items-center gap-1.5 bg-surface-base px-4 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2.5 after:bg-gradient-to-b after:from-surface-base after:to-transparent after:content-['']"
    :class="index ? 'border-t border-outline-gray-1' : ''"
    :style="{ top: `${index * HEIGHT}px`, height: `${HEIGHT}px` }"
    @click="$emit('toggle')"
  >
    <button
      type="button"
      class="flex items-center gap-1 py-1 text-base font-semibold text-ink-gray-8"
      :aria-expanded="open"
      @click.stop="$emit('toggle')"
    >
      {{ label }}
      <span
        class="size-4 text-ink-gray-5 opacity-0 transition group-hover/section:opacity-100 group-focus-within/section:opacity-100"
        :class="open ? 'lucide-chevron-up' : 'lucide-chevron-down'"
        aria-hidden="true"
      />
    </button>
    <div class="ml-auto" @click.stop>
      <slot name="header-action" />
    </div>
  </div>

  <div v-if="open" class="flex flex-col gap-2.5 px-4 pb-3 pt-2.5">
    <div
      v-for="field in fields"
      :key="field.label"
      class="grid grid-cols-[130px_1fr] items-center gap-2"
    >
      <span class="truncate text-base text-ink-gray-5">{{ field.label }}</span>
      <div
        class="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 hover:bg-surface-gray-2"
        @click="editField(field)"
      >
        <span
          class="truncate text-base"
          :class="field.value ? 'text-ink-gray-8' : 'text-ink-gray-4'"
        >
          {{ field.value || `Add ${field.label}...` }}
        </span>
        <span
          v-if="field.link"
          class="lucide-arrow-up-right ml-auto size-3.5 shrink-0 text-ink-gray-5"
          aria-hidden="true"
        />
      </div>
    </div>
    <p v-if="!fields.length" class="px-1.5 text-base text-ink-gray-4">
      Nothing here
    </p>
  </div>
</template>

<script setup lang="ts">
import { editField } from './dirtyState'
import type { PanelField } from './genericMock'

// Headers stack rather than push, so each pins below the ones before it — a fixed height
// is what makes that offset knowable. The fade hangs below the box, in the fields' top
// padding, so a pinned header covers the fade of the one above it.
const HEIGHT = 42

defineProps<{
  label: string
  fields: PanelField[]
  open: boolean
  index: number
}>()

defineEmits<{ toggle: [] }>()
</script>

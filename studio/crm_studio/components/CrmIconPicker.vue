<template>
  <!-- Portalled to the body (the default), not into the host dialog: nested in
    the dialog the panel is clipped by its bounds instead of flipping. -->
  <Popover v-model:open="isOpen" side="bottom" align="start">
    <template #trigger>
      <button
        type="button"
        class="grid size-6 shrink-0 place-content-center rounded text-ink-gray-7 transition hover:bg-surface-gray-3 focus-visible:focus-ring"
        :aria-label="`Change icon${label ? ` for ${label}` : ''}`"
      >
        <Icon :name="modelValue" class="size-4" />
      </button>
    </template>

    <div class="flex w-60 flex-col">
      <!-- Mirrors Combobox's own search row: flush to the panel edge, divided
        from the results rather than boxed. -->
      <div
        class="flex items-center gap-2 border-b border-outline-gray-1 px-3"
        data-slot="content-search"
      >
        <input
          ref="searchInput"
          v-model="search"
          type="text"
          class="min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-base text-ink-gray-8 outline-none placeholder:text-ink-gray-4 focus:ring-0"
          placeholder="Search icons"
          autocomplete="off"
          @keydown.enter="pickFirst"
        />
      </div>

      <div
        v-if="results.length"
        class="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto p-2"
      >
        <button
          v-for="name in results"
          :key="name"
          type="button"
          class="grid size-6 place-content-center rounded text-ink-gray-7 transition hover:bg-surface-gray-2"
          :class="
            name === modelValue ? 'bg-surface-gray-3 text-ink-gray-9' : ''
          "
          :title="name"
          :aria-label="name"
          @click="pick(name)"
        >
          <Icon :name="name" class="size-4" />
        </button>
      </div>
      <p v-else class="p-4 text-center text-p-sm text-ink-gray-5">
        No icons match “{{ search }}”
      </p>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { Popover } from 'frappe-ui'
import { Icon } from 'frappe-ui/icons'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { iconNames } from '@app/data/icons'

defineProps<{
  /** A bare Lucide sprite name — never a `lucide-` CSS class. */
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [name: string] }>()

const MAX_RESULTS = 64

const isOpen = ref(false)
const search = ref('')
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')

watch(isOpen, async (open) => {
  if (!open) return
  search.value = ''
  await nextTick()
  searchInput.value?.focus()
})

const results = computed(() => {
  const term = search.value.trim().toLowerCase()
  const names = term
    ? iconNames().filter((name) => name.includes(term))
    : iconNames()
  return names.slice(0, MAX_RESULTS)
})

function pickFirst() {
  const [first] = results.value
  if (first) pick(first)
}

function pick(name: string) {
  emit('update:modelValue', name)
  isOpen.value = false
}
</script>

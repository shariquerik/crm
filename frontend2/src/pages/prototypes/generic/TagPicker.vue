<!-- PROTOTYPE — throwaway. The only way tags are added or removed; the trigger differs,
     the picker does not. Icon trigger while the record has none, a "+" once it has some. -->
<template>
  <Popover>
    <template #target="{ togglePopover }">
      <button
        v-if="chip"
        type="button"
        class="grid size-5 place-content-center rounded-full text-ink-gray-5 transition hover:bg-surface-gray-3 hover:text-ink-gray-8"
        aria-label="Add tag"
        @click="togglePopover()"
      >
        <span class="lucide-plus size-3.5" aria-hidden="true" />
      </button>

      <Tooltip v-else text="Tags">
        <Button icon="lucide-tag" variant="ghost" @click="togglePopover()" />
      </Tooltip>
    </template>

    <template #body-main>
      <div class="w-60">
        <div class="flex items-center gap-2 border-b border-outline-gray-1 px-3 py-2">
          <input
            v-model="query"
            type="text"
            placeholder="Search or create tags"
            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 placeholder:text-ink-gray-4 focus:ring-0"
          />
          <kbd
            class="rounded border border-outline-gray-2 px-1.5 py-0.5 font-sans text-sm text-ink-gray-4"
          >
            G
          </kbd>
        </div>

        <div class="p-1.5">
          <label
            v-for="tag in matches"
            :key="tag"
            class="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-surface-gray-2"
          >
            <Checkbox
              :modelValue="recordTags.includes(tag)"
              padding="sm"
              @update:modelValue="toggle(tag)"
            />
            <span
              class="size-2 shrink-0 rounded-full"
              :class="tagColor(tag)"
              aria-hidden="true"
            />
            <span class="truncate text-base text-ink-gray-8">{{ tag }}</span>
          </label>

          <button
            v-if="canCreate"
            type="button"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-base text-ink-gray-6 hover:bg-surface-gray-2"
            @click="create()"
          >
            <span class="lucide-plus size-3.5" aria-hidden="true" />
            Create “{{ query.trim() }}”
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Checkbox, Popover, Tooltip } from 'frappe-ui'

import { addTag, knownTags, recordTags, removeTag, tagColor } from './tagState'

defineProps<{ chip?: boolean }>()

const query = ref('')

const matches = computed(() =>
  knownTags.filter((tag) =>
    tag.toLowerCase().includes(query.value.trim().toLowerCase()),
  ),
)

const canCreate = computed(
  () => Boolean(query.value.trim()) && !knownTags.includes(query.value.trim()),
)

function toggle(tag: string) {
  if (recordTags.value.includes(tag)) removeTag(tag)
  else addTag(tag)
}

function create() {
  addTag(query.value.trim())
  query.value = ''
}
</script>

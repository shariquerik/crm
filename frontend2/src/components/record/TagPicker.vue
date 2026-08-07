<!-- The only way tags are added or removed; the trigger differs, the picker does not.
     Icon trigger while the record has none, a "+" once it has some, and a bare anchor
     when something else does the opening. -->
<template>
  <MultiSelect
    :open="open"
    :modelValue="tags"
    :options="options"
    :loading="loading"
    :empty-text="error || 'No tags found'"
    placeholder="Search or create tags"
    :side="side"
    @update:modelValue="retag"
    @update:query="onQuery"
    @update:open="(opened: boolean) => (open = opened)"
  >
    <template #trigger>
      <button
        v-if="chip"
        type="button"
        class="grid size-5 place-content-center rounded-full text-ink-gray-5 transition hover:bg-surface-gray-3 hover:text-ink-gray-8"
        aria-label="Add tag"
      >
        <span class="lucide-plus size-3.5" aria-hidden="true" />
      </button>

      <!-- It only positions the popover; letting it take clicks would swallow the
           trigger it covers. -->
      <div
        v-else-if="anchored"
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <!-- The trigger must own a box of its own: Tooltip drops the $attrs the popover
           anchors on, and a display:contents wrapper would anchor it at 0,0. -->
      <div v-else class="flex shrink-0">
        <Tooltip text="Tags" :placement="vertical ? 'left' : 'top'">
          <Button icon="lucide-tag" variant="subtle" />
        </Tooltip>
      </div>
    </template>

    <template #item-prefix="{ item }">
      <span
        class="size-2 shrink-0 rounded-full"
        :class="tagColor(item.label)"
        aria-hidden="true"
      />
    </template>

    <template #footer>
      <button
        v-if="canCreate"
        type="button"
        class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-base text-ink-gray-6 hover:bg-surface-gray-2"
        @click="create()"
      >
        <span class="lucide-plus size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">Create “{{ query.trim() }}”</span>
      </button>
    </template>
  </MultiSelect>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, MultiSelect, Tooltip } from 'frappe-ui'

import { useTagSearch } from '@/composables/useTagSearch'
import { listDiff } from '@/data/docinfo'
import { canCreateTag, matchingTags, tagColor } from '@/data/tags'

const props = defineProps<{
  doctype: string
  tags: string[]
  chip?: boolean
  anchored?: boolean
  vertical?: boolean
}>()

const emit = defineEmits<{ add: [string]; remove: [string] }>()

// Left undefined the picker owns its own open state, which is what every trigger but
// the anchor wants.
const open = defineModel<boolean | undefined>('open', { default: undefined })

// The anchor hangs off a menu that already opened downwards.
const side = computed(() => {
  if (props.anchored) return 'bottom'
  return props.vertical ? 'left' : 'top'
})

const query = ref('')

// The record's own tags fill the gaps a paged answer leaves, so one already on it is
// never offered as new.
const ownTags = computed(() =>
  matchingTags(props.tags, query.value).map((tag) => ({
    label: tag,
    value: tag,
  })),
)

const { options, loading, error, searched, search, searchSoon } = useTagSearch(
  () => props.doctype,
  ownTags,
)

// Watched, not handled: opened from the outside, the picker never fires update:open.
watch(open, (opened) => opened && !searched.value && search())

function onQuery(text: string) {
  query.value = text
  searchSoon(text)
}

const canCreate = computed(() =>
  canCreateTag(
    options.value.map((option) => option.value),
    query.value,
  ),
)

// The selection is server state: each pick fires one mutation and the refetch repaints it.
function retag(picked: string[]) {
  const { added, dropped } = listDiff(picked, props.tags)
  added.forEach((tag) => emit('add', tag))
  dropped.forEach((tag) => emit('remove', tag))
}

function create() {
  emit('add', query.value.trim())
  query.value = ''
}
</script>

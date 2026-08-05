<!-- Who the record is shared with: stacked avatars over the dialog that changes it. -->
<template>
  <!-- w-fit: a grid child stretches, and the hover would run the column's whole width. -->
  <button
    type="button"
    class="flex w-fit min-w-0 items-center gap-1 rounded px-1.5 py-1 transition hover:bg-surface-gray-2"
    :aria-label="summary"
    @click="emit('open')"
  >
    <!-- The row's label already says what this is; the placeholder says what to do. -->
    <span v-if="!shared.length" class="truncate text-base text-ink-gray-4">
      Add people…
    </span>
    <!-- ring-outline-* are the only generated ring tokens; ring-surface-base falls
         back to tailwind's default blue. -->
    <span v-else class="flex -space-x-1.5">
      <Tooltip
        v-for="person in visible"
        :key="person.user"
        :text="person.fullName"
      >
        <Avatar
          class="ring-2 ring-outline-base transition hover:z-10 hover:scale-110"
          :label="person.fullName"
          :image="person.image"
          size="sm"
        />
      </Tooltip>
      <span
        v-if="overflow"
        class="z-10 grid size-5 place-items-center rounded-full bg-surface-gray-3 text-p-xs-medium text-ink-gray-7"
      >
        +{{ overflow }}
      </span>
    </span>

    <!-- One person has room for a name; a stack has to speak through its tooltips. -->
    <span v-if="only" class="truncate text-base text-ink-gray-8">
      {{ only.fullName }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, Tooltip } from 'frappe-ui'

import type { SharedUser } from '@/data/docinfo'

const MAX_AVATARS = 4

const props = defineProps<{ shared: SharedUser[] }>()

const emit = defineEmits<{ open: [] }>()

const visible = computed(() => props.shared.slice(0, MAX_AVATARS))

const overflow = computed(() => Math.max(0, props.shared.length - MAX_AVATARS))

const only = computed(() =>
  props.shared.length === 1 ? props.shared[0] : null,
)

const summary = computed(() =>
  props.shared.length
    ? `Shared with ${props.shared.map(({ fullName }) => fullName).join(', ')}`
    : 'Share with…',
)
</script>

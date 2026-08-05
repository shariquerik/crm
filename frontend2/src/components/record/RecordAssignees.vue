<!-- The record's assignees: stacked avatars over the assignment menu. -->
<template>
  <MultiSelect
    :modelValue="assigned"
    :options="options"
    :loading="loading"
    :empty-text="error || 'No users found'"
    placeholder="Assign to…"
    side="bottom"
    align="start"
    @update:modelValue="reassign"
    @update:query="searchSoon"
    @update:open="(open: boolean) => open && !searched && search()"
  >
    <template #trigger="{ open }">
      <button
        type="button"
        class="flex items-center gap-1 rounded px-1.5 py-1 transition hover:bg-surface-gray-2"
        :aria-label="summary"
      >
        <span
          v-if="!assignees.length"
          class="truncate text-base text-ink-gray-4"
        >
          Add people…
        </span>
        <span v-else class="flex -space-x-1.5">
          <!-- ring-outline-* are the only generated ring tokens; ring-surface-base
               falls back to tailwind's default blue. -->
          <Tooltip
            v-for="assignee in visible"
            :key="assignee.email"
            :text="assignee.fullName"
          >
            <Avatar
              class="ring-2 ring-outline-base transition hover:z-10 hover:scale-110"
              :label="assignee.fullName"
              :image="assignee.image"
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

        <!-- One assignee has room for a name; a stack has to speak through its tooltips. -->
        <span v-if="only" class="truncate text-base text-ink-gray-8">
          {{ only.fullName }}
        </span>
        <span
          v-if="assignees.length"
          :class="[
            'lucide-chevron-down size-3.5 text-ink-gray-5 transition-transform',
            open && 'rotate-180',
          ]"
        />
      </button>
    </template>

    <template #item-prefix="{ item }">
      <Avatar
        :label="item.label"
        :image="(item as UserOption).image"
        size="sm"
      />
    </template>
  </MultiSelect>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, MultiSelect, Tooltip } from 'frappe-ui'

import { useUserSearch, type UserOption } from '@/composables/useUserSearch'
import { assignmentDiff, type Assignee } from '@/data/docinfo'

const MAX_AVATARS = 3

const props = defineProps<{ assignees: Assignee[] }>()

const emit = defineEmits<{ assign: [string]; unassign: [string] }>()

const assigned = computed(() => props.assignees.map(({ email }) => email))

const assigneeOptions = computed<UserOption[]>(() =>
  props.assignees.map(({ email, fullName, image }) => ({
    label: fullName,
    value: email,
    image,
  })),
)

const { options, loading, error, searched, search, searchSoon } =
  useUserSearch(assigneeOptions)

const visible = computed(() => props.assignees.slice(0, MAX_AVATARS))

const only = computed(() =>
  props.assignees.length === 1 ? props.assignees[0] : null,
)

const overflow = computed(() =>
  Math.max(0, props.assignees.length - MAX_AVATARS),
)

const summary = computed(() =>
  props.assignees.length
    ? `Assigned to ${props.assignees.map(({ fullName }) => fullName).join(', ')}`
    : 'Assign to…',
)

// The selection is server state: each pick fires one mutation and the echo repaints it.
function reassign(picked: string[]) {
  const { added, dropped } = assignmentDiff(picked, props.assignees)
  added.forEach((email) => emit('assign', email))
  dropped.forEach((email) => emit('unassign', email))
}
</script>

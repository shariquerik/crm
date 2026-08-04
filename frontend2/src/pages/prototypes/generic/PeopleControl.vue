<!-- PROTOTYPE — throwaway. Only assignment is glanced at often enough to hold header
     space. Sharing and following are displayed by the surfaces that manage them. -->
<template>
  <Popover>
    <template #target="{ togglePopover }">
      <Tooltip text="Assigned to Sarah Connor, Dev Patel">
        <button
          type="button"
          class="flex items-center rounded-full p-0.5 transition hover:bg-surface-gray-2"
          @click="togglePopover()"
        >
          <AvatarGroup :items="assignees" />
        </button>
      </Tooltip>
    </template>

    <template #body-main>
      <div class="w-64 p-1.5">
        <div
          v-for="person in assignees"
          :key="person.fullName"
          class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-gray-2"
        >
          <Avatar :label="person.fullName" size="sm" />
          <span class="truncate text-base text-ink-gray-8">{{ person.fullName }}</span>
          <span
            class="lucide-x ml-auto size-3.5 shrink-0 text-ink-gray-4"
            aria-hidden="true"
          />
        </div>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-base text-ink-gray-5 hover:bg-surface-gray-2"
        >
          <span class="lucide-plus size-4" aria-hidden="true" />
          Assign to...
        </button>
      </div>
    </template>
  </Popover>
</template>

<script setup lang="ts">
import { Avatar, Popover, Tooltip } from 'frappe-ui'

import AvatarGroup from './AvatarGroup.vue'
import { assignees } from './genericMock'
</script>

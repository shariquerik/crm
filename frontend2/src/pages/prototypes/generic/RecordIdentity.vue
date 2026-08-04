<!-- PROTOTYPE — throwaway. The panel headline: who this record is, and what you do to it. -->
<template>
  <div
    class="flex shrink-0 flex-col gap-3 border-b border-outline-gray-1 px-4 py-5"
  >
    <div class="flex items-center gap-3">
      <Avatar :label="record.title" size="2xl" />
      <div class="min-w-0">
        <p class="truncate text-lg font-semibold text-ink-gray-9">
          {{ record.title }}
        </p>
        <p class="mt-1 truncate text-sm text-ink-gray-5">
          {{ record.subtitle }}
        </p>
      </div>
    </div>

    <TagRow />

    <RecordActions />
  </div>
</template>

<script setup lang="ts">
import { Avatar } from 'frappe-ui'

import RecordActions from './RecordActions.vue'
import TagRow from './TagRow.vue'
import { record } from './genericMock'
</script>

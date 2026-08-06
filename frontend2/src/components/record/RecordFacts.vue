<!-- The record's people as their own section, each line named by an icon and a label. -->
<template>
  <div class="flex flex-col gap-1.5 border-t border-outline-gray-1 px-4 py-3">
    <div :class="[ROW, 'items-center']">
      <span :class="LABEL">
        <span class="lucide-user size-4 shrink-0" aria-hidden="true" />
        Assigned to
      </span>
      <RecordAssignees
        :assignees="chrome.assignees"
        @assign="chrome.assign"
        @unassign="chrome.unassign"
      />
    </div>

    <div :class="[ROW, 'items-center']">
      <span :class="LABEL">
        <span class="lucide-share-2 size-4 shrink-0" aria-hidden="true" />
        Shared with
      </span>
      <RecordShare :shared="chrome.shared" @open="emit('share')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import RecordAssignees from '@/components/record/RecordAssignees.vue'
import RecordShare from '@/components/record/RecordShare.vue'
import type { RecordChrome } from '@/data/docinfo'

// PanelField's own grid, so these values sit on the details rows' left edge.
const ROW = 'grid grid-cols-[130px_1fr] gap-2'
const LABEL =
  'flex min-w-0 items-center gap-2 truncate text-base text-ink-gray-5'

defineProps<{ chrome: RecordChrome }>()

const emit = defineEmits<{ share: [] }>()
</script>

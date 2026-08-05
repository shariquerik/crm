<!-- The record's people and tags as their own section, each line named by an icon and a
     label. A row is here only once it has something to show. -->
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
        Share with
      </span>
      <RecordShare :shared="chrome.shared" @open="emit('share')" />
    </div>

    <!-- Tags wrap over several lines, so their label holds the first one's edge. -->
    <div v-if="chrome.tags.length" :class="[ROW, 'items-start']">
      <span :class="[LABEL, 'mt-1.5']">
        <span class="lucide-tag size-4 shrink-0" aria-hidden="true" />
        Tags
      </span>
      <!-- The rows above inset their avatars by a button's padding; the pills match it. -->
      <RecordTags class="px-1.5" :doctype="doctype" :chrome="chrome" />
    </div>
  </div>
</template>

<script setup lang="ts">
import RecordAssignees from '@/components/record/RecordAssignees.vue'
import RecordShare from '@/components/record/RecordShare.vue'
import RecordTags from '@/components/record/RecordTags.vue'
import type { RecordChrome } from '@/data/docinfo'

// PanelField's own grid, so these values sit on the details rows' left edge.
const ROW = 'grid grid-cols-[130px_1fr] gap-2'
const LABEL =
  'flex min-w-0 items-center gap-2 truncate text-base text-ink-gray-5'

defineProps<{ doctype: string; chrome: RecordChrome }>()

const emit = defineEmits<{ share: [] }>()
</script>

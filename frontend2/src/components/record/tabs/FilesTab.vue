<!-- What is attached to the record, oldest first, each with who added it and when. -->
<template>
  <RecordFeed v-bind="props" :doc="doc" :ready="activities.length > 0">
    <!-- RecordFeed restores this tab's own offset, so the timeline must not jump to newest. -->
    <ActivityTimeline
      v-if="activities.length || loading"
      :activities="activities"
      :loading="loading"
      :openAtBottom="false"
    >
      <template #item-file="{ activity }">
        <div class="flex min-w-0 flex-1 items-baseline justify-between gap-3">
          <p class="min-w-0 text-base text-ink-gray-7">
            <span class="font-medium text-ink-gray-9">
              {{ activity.author?.fullname }}
            </span>
            attached
            <a
              :href="fileOf(activity).file_url"
              target="_blank"
              class="font-medium text-ink-gray-9 hover:underline"
            >
              {{ fileOf(activity).file_name }}
            </a>
            <span
              v-if="fileOf(activity).is_private"
              class="lucide-lock ms-1 inline-block size-3.5 align-text-bottom text-ink-gray-5"
              aria-label="Private"
            />
          </p>
          <Tooltip :text="uploadedOn(activity.timestamp)">
            <span class="shrink-0 text-sm text-ink-gray-5">
              {{ uploadedAgo(activity.timestamp) }}
            </span>
          </Tooltip>
        </div>
      </template>
    </ActivityTimeline>

    <div v-else class="flex flex-col items-center justify-center gap-3 py-8">
      <span
        class="lucide-paperclip size-7 text-ink-gray-4"
        aria-hidden="true"
      />
      <span class="text-lg font-medium text-ink-gray-8">No files yet</span>
    </div>
  </RecordFeed>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Tooltip, dayjsLocal } from 'frappe-ui'
import {
  ActivityTimeline,
  type CustomActivity,
} from '@framework/ui/components/ActivityTimeline'

import RecordFeed from '@/components/record/RecordFeed.vue'
import { toFileActivities, type FileRow } from '@/data/files'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const files = props.feeds.files

onMounted(() => {
  if (!files.data) files.fetch()
})

const activities = computed(() => toFileActivities(files.data, props.docinfo))
const loading = computed(() => files.loading)

function fileOf(activity: CustomActivity) {
  return activity.data as FileRow
}

function uploadedAgo(timestamp?: string) {
  return timestamp ? dayjsLocal(timestamp).fromNow() : ''
}

function uploadedOn(timestamp?: string) {
  return timestamp
    ? dayjsLocal(timestamp).format('ddd, MMM D, YYYY h:mm A')
    : ''
}
</script>

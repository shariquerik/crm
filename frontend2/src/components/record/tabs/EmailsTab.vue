<!-- The record's email conversation, oldest first, paging back as it is read. -->
<template>
  <RecordFeed :name="item.name" :ready="emails.length > 0">
    <!-- RecordFeed restores this tab's own offset, so the timeline must not jump to newest. -->
    <ActivityTimeline
      v-if="emails.length || loading"
      :activities="emails"
      :loading="loading"
      :paginate="paginate"
      :openAtBottom="false"
    />
    <div v-else class="flex flex-col items-center justify-center gap-3 py-8">
      <span class="lucide-mail size-7 text-ink-gray-4" aria-hidden="true" />
      <span class="text-lg font-medium text-ink-gray-8">No emails yet</span>
    </div>
  </RecordFeed>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ActivityTimeline,
  useActivityTimeline,
} from '@framework/ui/components/ActivityTimeline'

import RecordFeed from '@/components/record/RecordFeed.vue'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
defineModel<Record<string, any>>('doc', { required: true })

// Cached per record: this is the resource Activity reads, not a second one.
const { activities, loading, paginate } = useActivityTimeline(
  props.doctype,
  props.docname,
)

const emails = computed(() =>
  activities.value.filter((activity) => activity.type === 'email'),
)
</script>

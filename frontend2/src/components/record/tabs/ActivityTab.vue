<!-- Everything said about the record, in one time order. -->
<template>
  <RecordFeed :name="item.name" :ready="activities.length > 0">
    <!-- RecordFeed restores this tab's own offset, so the timeline must not jump to newest. -->
    <ActivityTimeline
      :activities="activities"
      :loading="loading"
      :paginate="paginate"
      :openAtBottom="false"
    />
  </RecordFeed>
</template>

<script setup lang="ts">
import {
  ActivityTimeline,
  useActivityTimeline,
} from '@framework/ui/components/ActivityTimeline'

import RecordFeed from '@/components/record/RecordFeed.vue'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
defineModel<Record<string, any>>('doc', { required: true })

const { activities, loading, paginate } = useActivityTimeline(
  props.doctype,
  props.docname,
)
</script>

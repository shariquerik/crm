<!-- Everything said about the record, in one time order: the eleven docinfo buckets assembled. -->
<template>
  <RecordFeed :name="item.name" :ready="activities.length > 0">
    <!-- The record always has a created entry, so an empty feed means it has yet to land. -->
    <ActivityTimeline :activities="activities" :loading="!doc.creation" />
  </RecordFeed>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ActivityTimeline } from '@framework/ui/components/ActivityTimeline'

import RecordFeed from '@/components/record/RecordFeed.vue'
import { activityFeed } from '@/data/activity'
import { fieldLabels } from '@/data/fieldsLayout'
import type { TabProps } from '@/data/tabTypes'

const props = defineProps<Omit<TabProps, 'doc'>>()
const doc = defineModel<Record<string, any>>('doc', { required: true })

const activities = computed(() =>
  activityFeed(doc.value, props.docinfo, fieldLabels(props.layout)),
)
</script>

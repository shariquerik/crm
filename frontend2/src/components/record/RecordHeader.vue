<!-- The record's chrome: breadcrumbs, assignees and Save. -->
<template>
  <PageHeaderPortal>
    <div class="flex w-full items-center justify-between gap-3">
      <PageBreadcrumbs :items="breadcrumbs" />

      <div class="flex items-center gap-2">
        <RecordAssignees
          :assignees="assignees"
          @assign="emit('assign', $event)"
          @unassign="emit('unassign', $event)"
        />

        <Button
          v-if="isDirty"
          label="Save"
          variant="solid"
          :loading="saving"
          @click="emit('save')"
        />
      </div>
    </div>
  </PageHeaderPortal>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'

import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import RecordAssignees from '@/components/record/RecordAssignees.vue'
import type { Assignee } from '@/data/docinfo'

defineProps<{
  breadcrumbs: any[]
  assignees: Assignee[]
  isDirty: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: []
  assign: [string]
  unassign: [string]
}>()
</script>

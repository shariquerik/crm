<!-- The record's chrome: breadcrumbs and Save. -->
<template>
  <PageHeaderPortal>
    <div class="flex w-full items-center justify-between gap-3">
      <PageBreadcrumbs :items="breadcrumbs" />

      <div class="flex items-center gap-2">
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

defineProps<{
  breadcrumbs: any[]
  isDirty: boolean
  saving: boolean
}>()

const emit = defineEmits<{ save: [] }>()
</script>

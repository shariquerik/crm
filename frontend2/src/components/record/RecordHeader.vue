<!-- The record's chrome: breadcrumbs, the overflow menu and Save. -->
<template>
  <PageHeaderPortal>
    <div class="flex w-full items-center justify-between gap-3">
      <PageBreadcrumbs :items="breadcrumbs" />

      <div class="flex items-center gap-2">
        <RecordMenu
          :doctype="doctype"
          :docname="docname"
          :doc="doc"
          :chrome="chrome"
        />

        <Tooltip text="No changes to save" :disabled="isDirty">
          <!-- A disabled button fires no pointer events, so the wrapper has to
               own the box the tooltip hovers on. -->
          <div class="flex shrink-0">
            <Button
              label="Save"
              variant="solid"
              :disabled="!isDirty"
              :loading="saving"
              @click="emit('save')"
            />
          </div>
        </Tooltip>
      </div>
    </div>
  </PageHeaderPortal>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'

import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import RecordMenu from '@/components/record/RecordMenu.vue'
import type { RecordChrome } from '@/data/docinfo'

defineProps<{
  breadcrumbs: any[]
  doctype: string
  docname: string
  doc: Record<string, any>
  chrome: RecordChrome
  isDirty: boolean
  saving: boolean
}>()

const emit = defineEmits<{ save: [] }>()
</script>

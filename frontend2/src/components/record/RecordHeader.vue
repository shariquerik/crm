<!-- The record's chrome: breadcrumbs, the favourite star, the overflow menu and Save. -->
<template>
  <PageHeaderPortal>
    <div
      v-if="!doc.name"
      class="flex w-full items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2">
        <Skeleton class="h-4 w-12 rounded" />
        <span class="text-ink-gray-4">/</span>
        <Skeleton class="h-4 w-28 rounded" />
        <Skeleton class="ml-1 size-4 rounded-full" />
      </div>
      <div class="flex items-center gap-2">
        <Skeleton class="h-7 w-9 rounded" />
        <Skeleton class="h-7 w-16 rounded" />
      </div>
    </div>

    <div v-else class="flex w-full items-center justify-between gap-3">
      <div class="flex min-w-0 items-center">
        <PageBreadcrumbs :items="breadcrumbs" />

        <RecordFavourite
          :favourites="chrome.likers"
          :favourited="chrome.liked"
          @toggle="chrome.toggleLike"
        />
      </div>

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
import { Button, Skeleton, Tooltip } from 'frappe-ui'

import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import RecordFavourite from '@/components/record/RecordFavourite.vue'
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

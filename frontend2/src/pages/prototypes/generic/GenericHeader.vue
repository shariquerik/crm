<!-- PROTOTYPE — throwaway. Chrome placement held constant across the shape variants. The
     header carries the record's state; its verbs live in the panel's action strip. -->
<template>
  <PageHeaderPortal>
    <div class="flex w-full items-center justify-between gap-3">
      <div class="flex items-center gap-1.5 text-base text-ink-gray-5">
        <span>{{ record.doctypeLabel }}</span>
        <span class="lucide-chevron-right size-3.5" aria-hidden="true" />
        <span class="font-medium text-ink-gray-9">{{ record.title }}</span>
      </div>

      <div class="flex items-center gap-2">
        <slot />

        <PeopleControl />

        <Button>
          <template #prefix>
            <span :class="['size-2 rounded-full', record.statusColor]" />
          </template>
          {{ record.status }}
          <template #suffix>
            <span class="lucide-chevron-down size-3.5" aria-hidden="true" />
          </template>
        </Button>

        <Button v-if="isDirty" label="Save" variant="solid" @click="save" />
      </div>
    </div>
  </PageHeaderPortal>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'

import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import PeopleControl from './PeopleControl.vue'
import { isDirty, save } from './dirtyState'
import { record } from './genericMock'
</script>

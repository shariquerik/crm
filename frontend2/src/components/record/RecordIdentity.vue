<!-- The panel's headline: who this record is, what you do to it, and what is true of it.
     Never scrolls. -->
<template>
  <div
    v-if="!doc.name"
    class="flex shrink-0 flex-col border-b border-outline-gray-1"
  >
    <div class="flex flex-col gap-3 p-4">
      <div class="flex flex-col gap-2.5">
        <div class="flex flex-col gap-2">
          <Skeleton class="h-5 w-40 rounded" />
          <Skeleton class="h-4 w-28 rounded" />
        </div>
        <div class="flex items-center gap-1">
          <Skeleton
            v-for="button in 2"
            :key="button"
            class="h-7 w-28 rounded"
          />
          <Skeleton v-for="icon in 3" :key="icon" class="size-7 rounded" />
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-t border-outline-gray-1 px-4 py-3">
      <div
        v-for="fact in 2"
        :key="fact"
        class="grid grid-cols-[130px_1fr] items-center gap-2"
      >
        <Skeleton class="h-4 w-24 rounded" />
        <Skeleton class="h-4 w-28 rounded" />
      </div>
    </div>
  </div>

  <div v-else class="flex shrink-0 flex-col border-b border-outline-gray-1">
    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-start gap-3">
        <RecordImage
          v-if="meta?.image_field"
          v-model:doc="doc"
          :doctype="doctype"
          :label="identity.title"
        />
        <!-- Beside the tile the column spans its height, so both edges line up. -->
        <div
          class="flex min-w-0 flex-1 flex-col"
          :class="meta?.image_field ? 'h-20 justify-between' : 'gap-2.5'"
        >
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold text-ink-gray-9">
              {{ identity.title }}
            </p>
            <p class="mt-0.5 truncate text-sm text-ink-gray-5">
              {{ identity.subtitle }}
            </p>
          </div>

          <RecordActions
            :doctype="doctype"
            :docname="docname"
            :chrome="chrome"
          />
        </div>
      </div>
      <RecordTags :doctype="doctype" :chrome="chrome" />
    </div>

    <RecordFacts :chrome="chrome" @share="emit('share')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Skeleton } from 'frappe-ui'
import { useDoctypeMeta } from '@framework/ui'

import RecordActions from '@/components/record/RecordActions.vue'
import RecordFacts from '@/components/record/RecordFacts.vue'
import RecordImage from '@/components/record/RecordImage.vue'
import RecordTags from '@/components/record/RecordTags.vue'
import { doctypeLabel } from '@/data/doctypes'
import type { RecordChrome } from '@/data/docinfo'
import { recordIdentity } from '@/data/recordDoc'

const props = defineProps<{
  doctype: string
  docname: string
  chrome: RecordChrome
}>()

const emit = defineEmits<{ share: [] }>()

const doc = defineModel<Record<string, any>>('doc', { required: true })

const { meta } = useDoctypeMeta(() => props.doctype)

const identity = computed(() =>
  recordIdentity(doc.value, meta.value, doctypeLabel(props.doctype)),
)
</script>

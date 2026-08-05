<!-- The panel's headline: who this record is, and what you do to it. Never scrolls. -->
<template>
  <div
    class="flex shrink-0 flex-col gap-3 border-b border-outline-gray-1 px-4 py-5"
  >
    <div class="flex items-center gap-3">
      <Avatar :label="identity.title" :image="identity.image" size="2xl" />
      <div class="min-w-0">
        <p class="truncate text-lg font-semibold text-ink-gray-9">
          {{ identity.title }}
        </p>
        <p class="mt-1 truncate text-sm text-ink-gray-5">
          {{ identity.subtitle }}
        </p>
      </div>
    </div>

    <RecordTags :doctype="doctype" :chrome="chrome" />

    <RecordActions
      :doctype="doctype"
      :docname="docname"
      :doc="doc"
      :chrome="chrome"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar } from 'frappe-ui'
import { useDoctypeMeta } from '@framework/ui'

import RecordActions from '@/components/record/RecordActions.vue'
import RecordTags from '@/components/record/RecordTags.vue'
import { doctypeLabel } from '@/data/doctypes'
import type { RecordChrome } from '@/data/docinfo'
import { recordIdentity } from '@/data/recordDoc'

const props = defineProps<{
  doctype: string
  docname: string
  doc: Record<string, any>
  chrome: RecordChrome
}>()

const { meta } = useDoctypeMeta(() => props.doctype)

const identity = computed(() =>
  recordIdentity(props.doc, meta.value, doctypeLabel(props.doctype)),
)
</script>

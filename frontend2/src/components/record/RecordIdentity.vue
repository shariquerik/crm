<!-- The panel's headline: who this record is, what you do to it, and what is true of it.
     Never scrolls. -->
<template>
  <div class="flex shrink-0 flex-col border-b border-outline-gray-1">
    <div class="flex items-start gap-3 px-4 pb-4 pt-5">
      <RecordImage
        v-if="meta?.image_field"
        :label="identity.title"
        :image="identity.image"
        @update="setImage"
      />
      <!-- Beside the tile the column spans its height, so both edges line up. -->
      <div
        class="flex min-w-0 flex-col"
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
          compact
          @share="emit('share')"
        />
      </div>
    </div>

    <RecordFacts :doctype="doctype" :chrome="chrome" @share="emit('share')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDoctypeMeta } from '@framework/ui'

import RecordActions from '@/components/record/RecordActions.vue'
import RecordFacts from '@/components/record/RecordFacts.vue'
import RecordImage from '@/components/record/RecordImage.vue'
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

/** An upload lands in the doc like any other edit, and saves with it. */
function setImage(url: string) {
  const fieldname = meta.value?.image_field
  if (fieldname) doc.value = { ...doc.value, [fieldname]: url }
}
</script>

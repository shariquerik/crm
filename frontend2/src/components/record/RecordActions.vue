<!-- The record's quick actions: the verbs worth a button. Laid out in a row, or
     vertically in the collapsed rail. -->
<template>
  <TooltipProvider :hover-delay="0" :skip-delay="0.5">
    <div
      class="flex items-center gap-1"
      :class="vertical ? 'flex-col' : 'flex-wrap'"
    >
      <!-- The lead action is named; the rest carry their label in a tooltip. -->
      <Tooltip text="Write an email" :placement="placement">
        <Button
          icon="lucide-mail"
          :label="named ? 'Email' : undefined"
          :aria-label="named ? undefined : 'Write an email'"
          variant="subtle"
          @click="writeEmail"
        />
      </Tooltip>

      <RecordLike
        :likers="chrome.likers"
        :liked="chrome.liked"
        @toggle="chrome.toggleLike"
      />

      <Tooltip text="Attach a file" :placement="placement">
        <Button icon="lucide-paperclip" variant="subtle" @click="attach" />
      </Tooltip>

      <Tooltip text="Share" :placement="placement">
        <Button icon="lucide-share-2" variant="subtle" @click="emit('share')" />
      </Tooltip>

      <Tooltip text="Print" :placement="placement">
        <Button icon="lucide-printer" variant="subtle" @click="print" />
      </Tooltip>

      <TagPicker
        v-if="!chrome.tags.length"
        :doctype="doctype"
        :tags="chrome.tags"
        :vertical="vertical"
        @add="chrome.addTag"
        @remove="chrome.removeTag"
      />
    </div>

    <FileUploadDialog
      v-if="dialogMounted"
      v-model:open="dialogOpen"
      title="Attach files"
      multiple
      :transport="transport"
      @committed="chrome.reloadFiles"
    />
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Tooltip, TooltipProvider } from 'frappe-ui'

import { recordTransport } from '@/data/attachments'

import RecordLike from '@/components/record/RecordLike.vue'
import TagPicker from '@/components/record/TagPicker.vue'
import { requestReply } from '@/data/composerRequest'
import type { RecordChrome } from '@/data/docinfo'
import { printUrl } from '@/data/recordActions'
import { EMAILS_TAB, hasComposer } from '@/data/recordLayout'

const props = defineProps<{
  doctype: string
  docname: string
  chrome: RecordChrome
  vertical?: boolean
  /** Drops the lead action's label, for a row that shares its line. */
  compact?: boolean
}>()

const emit = defineEmits<{ share: [] }>()

// Lazily mounted: the uploader and its cropper load only when attaching.
const FileUploadDialog = defineAsyncComponent(
  () => import('@framework/ui/components/FileUpload/FileUploadDialog.vue'),
)

const dialogMounted = ref(false)
const dialogOpen = ref(false)

const route = useRoute()
const router = useRouter()

const placement = computed(() => (props.vertical ? 'left' : 'top'))

const named = computed(() => !props.vertical && !props.compact)

function writeEmail() {
  const tab = route.query.tab as string | undefined
  requestReply()
  if (!hasComposer(tab))
    router.replace({ query: { ...route.query, tab: EMAILS_TAB } })
}

const transport = computed(() => recordTransport(props.doctype, props.docname))

function attach() {
  dialogMounted.value = true
  dialogOpen.value = true
}

// The dialog closes itself once every row lands, and takes its cropper with it.
watch(dialogOpen, (open) => {
  if (!open) dialogMounted.value = false
})

function print() {
  window.open(printUrl(props.doctype, props.docname), '_blank')
}
</script>

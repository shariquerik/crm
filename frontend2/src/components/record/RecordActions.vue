<!-- Every verb that acts on the record: the quick actions, then the overflow menu holding
     the rest. Laid out in a row, or vertically in the collapsed rail. -->
<template>
  <TooltipProvider :hover-delay="0" :skip-delay="0.5">
    <div
      class="flex items-center gap-1"
      :class="vertical ? 'flex-col' : 'flex-wrap'"
    >
      <Tooltip text="Share" :placement="placement">
        <Button
          icon="lucide-share-2"
          variant="subtle"
          @click="sharing = true"
        />
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

      <Dropdown :options="menuOptions" :side="vertical ? 'left' : 'bottom'">
        <!-- The trigger must own a box: Tooltip drops the $attrs that anchor the menu,
             and a display:contents wrapper would anchor it at 0,0. -->
        <div class="flex shrink-0">
          <Tooltip text="More actions" :placement="placement">
            <Button icon="lucide-more-horizontal" variant="subtle" />
          </Tooltip>
        </div>
      </Dropdown>
    </div>
  </TooltipProvider>

  <ShareDialog
    v-model="sharing"
    :doctype="doctype"
    :docname="docname"
    :shared="chrome.shared"
    @share="chrome.share"
    @unshare="chrome.unshare"
  />

  <Dialog v-model="confirmingDelete" :options="deleteOptions" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Dialog,
  Dropdown,
  Tooltip,
  TooltipProvider,
  call,
  toast,
} from 'frappe-ui'

import ShareDialog from '@/components/record/ShareDialog.vue'
import TagPicker from '@/components/record/TagPicker.vue'
import type { RecordChrome } from '@/data/docinfo'
import { doctypeChanged } from '@/data/doctypeChanged'
import { errorMessage } from '@/data/errors'
import { duplicatePayload, printUrl } from '@/data/recordActions'

const props = defineProps<{
  doctype: string
  docname: string
  doc: Record<string, any>
  chrome: RecordChrome
  vertical?: boolean
}>()

const router = useRouter()

const sharing = ref(false)
const confirmingDelete = ref(false)

const placement = computed(() => (props.vertical ? 'left' : 'top'))

const listRoute = computed(() => `/${encodeURIComponent(props.doctype)}`)

const menuOptions = computed(() => [
  {
    label: props.chrome.following ? 'Following' : 'Follow',
    icon: props.chrome.following ? 'lucide-bell-ring' : 'lucide-bell',
    onClick: props.chrome.toggleFollow,
  },
  {
    label: 'Copy link',
    icon: 'lucide-link',
    onClick: () => copy(location.href),
  },
  { label: 'Copy ID', icon: 'lucide-hash', onClick: () => copy(props.docname) },
  { label: 'Duplicate', icon: 'lucide-copy', onClick: duplicate },
  {
    label: 'Delete',
    icon: 'lucide-trash-2',
    onClick: () => (confirmingDelete.value = true),
  },
])

function print() {
  window.open(printUrl(props.doctype, props.docname), '_blank')
}

function copy(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Copied')
}

async function duplicate() {
  try {
    const created = await call('frappe.client.insert', {
      doc: duplicatePayload(props.doc),
    })
    doctypeChanged(props.doctype)
    router.push(`${listRoute.value}/${encodeURIComponent(created.name)}`)
  } catch (error: any) {
    toast.error(errorMessage(error))
  }
}

// The dialog spins the action for as long as onClick is awaited, so it owns no loading
// state of its own.
const deleteOptions = computed(() => ({
  title: `Delete ${props.docname}?`,
  message: 'This cannot be undone.',
  actions: [
    { label: 'Delete', theme: 'red', variant: 'solid', onClick: remove },
  ],
}))

async function remove() {
  try {
    await call('frappe.client.delete', {
      doctype: props.doctype,
      name: props.docname,
    })
    doctypeChanged(props.doctype)
    router.push(listRoute.value)
  } catch (error: any) {
    toast.error(errorMessage(error))
  } finally {
    confirmingDelete.value = false
  }
}
</script>

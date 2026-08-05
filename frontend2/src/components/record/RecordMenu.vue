<!-- The record's overflow menu: every verb that is not worth a button of its own. -->
<template>
  <Dropdown :options="menuOptions" side="bottom" align="end">
    <!-- The trigger must own a box: Tooltip drops the $attrs that anchor the menu,
         and a display:contents wrapper would anchor it at 0,0. -->
    <div class="flex shrink-0">
      <Tooltip text="More actions">
        <Button icon="lucide-more-horizontal" variant="subtle" />
      </Tooltip>
    </div>
  </Dropdown>

  <Dialog v-model="confirmingDelete" :options="deleteOptions" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, Tooltip, call, toast } from 'frappe-ui'

import type { RecordChrome } from '@/data/docinfo'
import { doctypeChanged } from '@/data/doctypeChanged'
import { errorMessage } from '@/data/errors'
import { duplicatePayload } from '@/data/recordActions'

const props = defineProps<{
  doctype: string
  docname: string
  doc: Record<string, any>
  chrome: RecordChrome
}>()

const router = useRouter()

const confirmingDelete = ref(false)

const listRoute = computed(() => `/${encodeURIComponent(props.doctype)}`)

const menuOptions = computed(() => [
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

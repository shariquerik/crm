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
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, Tooltip, call, toast } from 'frappe-ui'

import type { RecordChrome } from '@/data/docinfo'
import { doctypeChanged } from '@/data/doctypeChanged'
import { errorMessage } from '@/data/errors'
import { RecordPageKey } from '@/data/pageContext'
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

type MenuAction = {
  name: string
  label: string
  icon: string
  group?: string
  run?: (page?: any) => void
}

// The built-in bands: the record's state, then its verbs, then the one that ends it.
const builtins = computed<MenuAction[]>(() => [
  {
    name: 'favourite',
    group: 'favourite',
    label: props.chrome.liked ? 'Remove from favourites' : 'Add to favourites',
    icon: props.chrome.liked ? 'lucide-star-off' : 'lucide-star',
    run: props.chrome.toggleLike,
  },
  {
    name: 'copy_url',
    label: 'Copy record URL',
    icon: 'lucide-link',
    run: () => copy(location.href),
  },
  {
    name: 'copy_id',
    label: 'Copy record ID',
    icon: 'lucide-hash',
    run: () => copy(props.docname),
  },
  {
    name: 'duplicate',
    label: 'Duplicate',
    icon: 'lucide-copy',
    run: duplicate,
  },
  {
    name: 'delete',
    group: 'delete',
    label: 'Delete',
    icon: 'lucide-trash-2',
    run: () => (confirmingDelete.value = true),
  },
])

const controller = inject(RecordPageKey, null)
controller?.headerActions.provideBuiltins(() => builtins.value)

const resolved = computed<MenuAction[]>(() =>
  controller
    ? (controller.headerActions.visible() as MenuAction[])
    : builtins.value,
)

const menuOptions = computed(() =>
  bands(resolved.value).map((band) => ({
    group: band.group,
    hideLabel: true,
    options: band.items.map((item) => ({
      label: item.label,
      icon: item.icon,
      onClick: () => item.run?.(controller?.page),
    })),
  })),
)

// Bands are derived from the one flat list by adjacency: an omitted `group`
// means `actions`, an unknown value makes a new band where its first item sits.
function bands(items: MenuAction[]) {
  const result: { group: string; items: MenuAction[] }[] = []
  for (const item of items) {
    const group = item.group ?? 'actions'
    const last = result[result.length - 1]
    if (last?.group === group) last.items.push(item)
    else result.push({ group, items: [item] })
  }
  return result
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

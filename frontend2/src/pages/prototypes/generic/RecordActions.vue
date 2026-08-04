<!-- PROTOTYPE — throwaway. Every verb that acts on the record: the configured quick actions,
     then the overflow menu holding the rest. Laid out in a row, or in the collapsed rail. -->
<template>
  <TooltipProvider :hover-delay="0" :skip-delay="0.5">
    <div
      class="flex items-center gap-1"
      :class="vertical ? 'flex-col' : 'flex-wrap'"
    >
      <Tooltip text="Send email" :placement="placement">
        <Button
          :label="vertical ? undefined : 'Email'"
          :icon="vertical ? 'lucide-mail' : undefined"
          :icon-left="vertical ? undefined : 'lucide-mail'"
          variant="subtle"
        />
      </Tooltip>
      <Tooltip text="Call" :placement="placement">
        <Button icon="lucide-phone" variant="subtle" />
      </Tooltip>
      <Tooltip text="Attach a file" :placement="placement">
        <Button icon="lucide-paperclip" variant="subtle" />
      </Tooltip>
      <Tooltip text="Share" :placement="placement">
        <Button
          icon="lucide-share-2"
          variant="subtle"
          @click="sharing = true"
        />
      </Tooltip>
      <Tooltip text="Print" :placement="placement">
        <Button icon="lucide-printer" variant="subtle" />
      </Tooltip>
      <TagPicker v-if="!recordTags.length" />
      <Dropdown
        :options="menuOptions"
        :placement="vertical ? 'left' : 'bottom'"
      >
        <Button icon="lucide-more-horizontal" variant="subtle" />
      </Dropdown>
      <slot />
    </div>
  </TooltipProvider>

  <ShareDialog v-model="sharing" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Dropdown, Tooltip, TooltipProvider, toast } from 'frappe-ui'

import ShareDialog from './ShareDialog.vue'
import TagPicker from './TagPicker.vue'
import { record } from './genericMock'
import { recordTags } from './tagState'

const props = defineProps<{ vertical?: boolean }>()

const sharing = ref(false)
const following = ref(false)

const placement = computed(() => (props.vertical ? 'left' : 'top'))

const menuOptions = computed(() => [
  {
    label: following.value ? 'Following' : 'Follow',
    icon: following.value ? 'lucide-bell-ring' : 'lucide-bell',
    onClick: () => (following.value = !following.value),
  },
  {
    label: 'Copy link',
    icon: 'lucide-link',
    onClick: () => copy(location.href),
  },
  { label: 'Copy ID', icon: 'lucide-hash', onClick: () => copy(record.id) },
  { label: 'Duplicate', icon: 'lucide-copy' },
  { label: 'Delete', icon: 'lucide-trash-2' },
])

function copy(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Copied')
}
</script>

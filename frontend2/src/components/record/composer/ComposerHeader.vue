<!-- The reply header, rendered through EmailComposer's #header slot so CRM owns the rows. -->
<template>
  <div class="px-2.5 pt-2">
    <div class="flex items-center gap-1 py-1.5">
      <input
        v-model="subject"
        type="text"
        placeholder="Subject"
        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-medium text-ink-gray-9 focus:ring-0"
      />
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <Button
          v-for="field in OPTIONAL_FIELDS"
          :key="field"
          variant="ghost"
          size="sm"
          :label="labelOf(field)"
          :class="open[field] ? '!bg-surface-gray-4' : '!text-ink-gray-5'"
          @click="toggle(field)"
        />
        <CollapseButton @collapse="emit('collapse')" />
      </div>
    </div>

    <div
      v-for="field in rows"
      :key="field"
      class="flex items-start gap-2 py-1.5"
    >
      <span
        class="relative bottom-0.5 mt-1 w-[52px] shrink-0 text-p-sm text-ink-gray-4"
      >
        {{ labelOf(field) }}
      </span>
      <RecipientInput
        class="flex-1"
        :model-value="recipients[field]"
        @update:model-value="setRow(field, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import { Button } from 'frappe-ui'
import type { Recipient, Recipients } from '@framework/ui/components/Composer'

import CollapseButton from './CollapseButton.vue'
import RecipientInput from './RecipientInput.vue'

const OPTIONAL_FIELDS = ['cc', 'bcc'] as const

type OptionalField = (typeof OPTIONAL_FIELDS)[number]
type Field = 'to' | OptionalField

const emit = defineEmits<{ collapse: [] }>()

const subject = defineModel<string>('subject', { default: '' })
const recipients = defineModel<Recipients>('recipients', { required: true })

const open = reactive<Record<OptionalField, boolean>>({ cc: false, bcc: false })

watchEffect(() => {
  for (const field of OPTIONAL_FIELDS)
    if (recipients.value[field].length) open[field] = true
})

const rows = computed<Field[]>(() => [
  'to',
  ...OPTIONAL_FIELDS.filter((field) => open[field]),
])

function toggle(field: OptionalField) {
  open[field] = !open[field]
  if (!open[field]) setRow(field, [])
}

// Replaced whole: the draft persists by ref identity, so a nested write never reaches it.
function setRow(field: Field, list: Recipient[]) {
  recipients.value = { ...recipients.value, [field]: list }
}

function labelOf(field: Field) {
  return { to: 'To', cc: 'Cc', bcc: 'Bcc' }[field]
}
</script>

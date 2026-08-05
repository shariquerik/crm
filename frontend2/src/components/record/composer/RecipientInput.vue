<!-- One addressing row's input: Recipient objects over MultiEmailInput's plain emails. -->
<template>
  <div class="w-full flex-1">
    <MultiEmailInput
      v-model="emails"
      class="!gap-1 !bg-transparent !p-0"
      placeholder=""
    >
      <template #tag="{ value, option, removeTag }">
        <Avatar size="xs" :label="option?.label || value" />
        <span class="truncate">{{ option?.label || value }}</span>
        <button
          class="grid size-4 place-items-center rounded-sm text-ink-gray-5 hover:bg-surface-gray-4"
          @click.stop="removeTag"
        >
          <FeatherIcon name="x" class="size-3" />
        </button>
      </template>
    </MultiEmailInput>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, FeatherIcon } from 'frappe-ui'
import { MultiEmailInput } from 'frappe-ui/experimental'
import type { Recipient } from '@framework/ui/components/Composer'

const model = defineModel<Recipient[]>({ default: () => [] })

const emails = computed<string[]>({
  get: () => [...new Set(model.value.map((recipient) => recipient.email))],
  set: (next) => {
    const known = new Map(
      model.value.map((recipient) => [recipient.email, recipient]),
    )
    model.value = next.map((email) => known.get(email) ?? { email })
  },
})
</script>

<style scoped>
/* The row reads as one line, so the control's own focus ring is dropped; chips keep theirs. */
:deep([data-slot='control']:focus-within) {
  box-shadow: none;
  outline: none;
}
</style>

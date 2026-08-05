<!-- Two people wrote the same fields: pick which values to keep, one field at a time. -->
<template>
  <Dialog v-model="open" size="md">
    <template #body>
      <div class="p-4 pt-5">
        <h3 class="text-lg font-semibold text-ink-gray-9">
          {{ conflict.editor }} edited this record while you were working
        </h3>
        <p class="mt-1 text-base text-ink-gray-6">
          You both changed {{ fieldCount }}. Pick which values to keep.
        </p>

        <div
          v-for="field in conflict.fields"
          :key="field.fieldname"
          class="mt-4"
        >
          <div class="text-base font-medium text-ink-gray-8">
            {{ field.label }}
          </div>
          <label
            v-for="side in sidesOf(field)"
            :key="side.key"
            class="mt-1.5 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-gray-2"
          >
            <input
              type="radio"
              class="size-3.5 shrink-0 accent-surface-gray-7"
              :name="field.fieldname"
              :value="side.key"
              :checked="choices[field.fieldname] === side.key"
              @change="choices[field.fieldname] = side.key"
            />
            <span class="w-32 shrink-0 truncate text-base text-ink-gray-5">
              {{ side.owner }}
            </span>
            <span class="truncate text-base text-ink-gray-8">
              {{ side.display }}
            </span>
          </label>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button label="Discard my changes" @click="emit('discard')" />
          <Button
            variant="solid"
            label="Save"
            @click="emit('resolve', choices)"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Dialog } from 'frappe-ui'

import type { Choices, Conflict, ConflictField } from '@/data/recordDoc'

const props = defineProps<{ conflict: Conflict }>()
const emit = defineEmits<{ resolve: [Choices]; discard: [] }>()

const open = defineModel<boolean>({ required: true })

// Theirs by default, so an accidental Save never destroys a write the user never saw.
const choices = ref<Choices>(
  Object.fromEntries(
    props.conflict.fields.map((field) => [field.fieldname, 'theirs']),
  ),
)

const fieldCount = computed(() =>
  props.conflict.fields.length === 1
    ? '1 field'
    : `${props.conflict.fields.length} fields`,
)

function sidesOf(field: ConflictField) {
  return [
    { key: 'mine' as const, owner: 'Yours', display: field.mine.display },
    {
      key: 'theirs' as const,
      owner: `${props.conflict.editor}'s`,
      display: field.theirs.display,
    },
  ]
}
</script>

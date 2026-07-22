<template>
  <Dialog v-model="show" title="Customize sidebar" size="md">
    <div class="flex flex-col gap-4">
      <Draggable
        v-model="items"
        item-key="dt"
        handle=".rail-drag-handle"
        class="flex min-h-8 flex-col rounded-lg border border-outline-gray-2 p-1.5"
      >
        <template #item="{ element }">
          <div
            class="group flex h-8 items-center gap-2 rounded px-1 hover:bg-surface-gray-1"
          >
            <span
              class="rail-drag-handle lucide-grip-vertical size-3.5 shrink-0 cursor-grab text-ink-gray-4"
              aria-hidden="true"
            />
            <CrmIconPicker
              :modelValue="doctypeIcon(element.dt, element.icon)"
              :label="element.label"
              @update:modelValue="(icon: string) => (element.icon = icon)"
            />
            <!-- The label is what the rail shows on hover. It reads as text
              until asked for: the pencil, or a double-click on it. -->
            <input
              v-if="editing === element.dt"
              v-model="element.label"
              data-rail-label-editor
              class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 focus:border-0 focus:outline-none focus:ring-0"
              :placeholder="element.dt"
              :aria-label="`Label for ${element.dt}`"
              autocomplete="off"
              @keydown.enter.prevent="stopEditing(element)"
              @keydown.esc.stop.prevent="cancelEditing(element)"
              @blur="stopEditing(element)"
            />
            <span
              v-else
              class="min-w-0 flex-1 cursor-text truncate text-base text-ink-gray-8"
              @dblclick="startEditing(element)"
            >
              {{ element.label }}
            </span>
            <div class="flex gap-1">
              <Button
                v-if="editing !== element.dt"
                variant="ghost"
                size="xs"
                icon="lucide-pencil"
                tooltip="Rename"
                :label="`Rename ${element.label}`"
                class="shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                @click="startEditing(element)"
              />
              <Button
                v-if="editing !== element.dt"
                variant="ghost"
                size="xs"
                icon="lucide-x"
                tooltip="Remove from sidebar"
                :label="`Remove ${element.label}`"
                class="shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                @click="remove(element)"
              />
            </div>
          </div>
        </template>
        <template #footer>
          <p
            v-if="!items.length"
            class="py-2 text-center text-p-sm text-ink-gray-5"
          >
            Nothing in the sidebar yet
          </p>
        </template>
      </Draggable>

      <!-- A picker that never holds a value: choosing appends a row, then the
        selection is cleared so the field returns to its placeholder. -->
      <Combobox
        v-model="picked"
        :options="addableOptions"
        placeholder="Add a doctype"
      />

      <ErrorMessage :message="error" />
    </div>

    <template #actions>
      <Button
        class="w-full"
        variant="solid"
        label="Save"
        :loading="saving"
        :disabled="!canSave"
        @click="save"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, Combobox, Dialog, ErrorMessage } from 'frappe-ui'
import { computed, nextTick, ref, watch } from 'vue'
// @ts-expect-error — vuedraggable ships no bundled types
import Draggable from 'vuedraggable'

import CrmIconPicker from '@app/components/CrmIconPicker.vue'
import { doctypeIcon } from '@app/data/doctypes'
import {
  addableDoctypes,
  railItems,
  railLayout,
  saveRailItems,
  type RailItem,
} from '@app/data/railLayout'

const show = defineModel<boolean>({ required: true })

const items = ref<RailItem[]>([])
const saved = ref('')
const saving = ref(false)
const error = ref('')
const editing = ref('')
const labelBeforeEdit = ref('')
const picked = ref<string | null>(null)

watch(show, (open) => {
  if (!open) return
  reset()
  if (!addableDoctypes.fetched) addableDoctypes.fetch()
})

function reset() {
  items.value = railItems.value.map((item) => ({ ...item }))
  saved.value = signature()
  error.value = ''
  editing.value = ''
}

function startEditing(item: RailItem) {
  labelBeforeEdit.value = item.label
  editing.value = item.dt
}

function stopEditing(item: RailItem) {
  if (editing.value !== item.dt) return
  // A blank label would leave an unreadable tooltip, so it reverts rather than
  // silently falling back to the doctype name.
  if (!item.label.trim()) item.label = labelBeforeEdit.value
  editing.value = ''
}

function cancelEditing(item: RailItem) {
  item.label = labelBeforeEdit.value
  editing.value = ''
}

// Focus waits for the render to settle rather than riding a template ref:
// `v-model`'s own mounted hook assigns `el.value` after the ref fires, and that
// assignment collapses a selection made before it. Selecting all means typing
// replaces the label, as renaming does elsewhere.
watch(editing, async (doctype) => {
  if (!doctype) return
  await nextTick()
  const field = document.querySelector<HTMLInputElement>(
    '[data-rail-label-editor]',
  )
  field?.focus()
  field?.select()
})

// Order, labels and icons all count as changes, so the whole list is the
// comparison — it is exactly what gets sent.
function signature() {
  return JSON.stringify(
    items.value.map(({ dt, label, icon }) => [dt, label, icon ?? '']),
  )
}

const canSave = computed(
  () => signature() !== saved.value && items.value.length > 0,
)

const addableOptions = computed(() => {
  const listed = new Set(items.value.map((item) => item.dt))
  return (addableDoctypes.data ?? [])
    .filter((doctype: string) => !listed.has(doctype))
    .map((doctype: string) => ({ label: doctype, value: doctype }))
})

function remove(item: RailItem) {
  items.value = items.value.filter((candidate) => candidate.dt !== item.dt)
}

// Clearing has to wait a tick: the Combobox only re-reads the model when the
// bound value changes, so it has to see the pick land before it is undone.
watch(picked, async (doctype) => {
  if (!doctype) return
  items.value.push({ dt: doctype, label: doctype })
  await nextTick()
  picked.value = null
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    await saveRailItems(items.value)
    show.value = false
  } catch (exception: any) {
    error.value = exception?.messages?.[0] || 'Failed to update the sidebar'
    railLayout.reload()
  } finally {
    saving.value = false
  }
}
</script>

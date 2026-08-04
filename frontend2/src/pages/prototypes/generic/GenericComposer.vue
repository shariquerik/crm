<!-- PROTOTYPE — throwaway. The timeline's footer: a one-line invitation that opens into the
     full editor, replying by default and switching to a comment from inside. -->
<template>
  <div class="pointer-events-none mx-auto w-full max-w-3xl">
    <div v-if="!open" class="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-base px-3 text-left text-base text-ink-gray-4 shadow-md hover:border-outline-gray-3"
        @click="expand('Reply')"
      >
        <Avatar :label="currentUser.fullName" size="sm" />
        Reply to {{ record.title }}
      </button>

      <Tooltip text="Add a comment">
        <button
          type="button"
          class="grid size-9 shrink-0 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2"
          @click="expand('Comment')"
        >
          <span class="lucide-message-circle size-4" aria-hidden="true" />
        </button>
      </Tooltip>

      <Dropdown :options="tabActions" side="top" placement="right">
        <!-- The trigger must own the handlers and a box: Tooltip drops $attrs, and a
             display:contents wrapper would anchor the menu at 0,0. -->
        <div class="flex shrink-0">
          <Tooltip text="Add to this record">
            <button
              type="button"
              class="grid size-9 shrink-0 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2"
            >
              <span class="lucide-plus size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </Dropdown>
    </div>

    <div
      v-else
      class="pointer-events-auto flex flex-col rounded-xl border border-outline-gray-2 bg-surface-base shadow-lg"
    >
      <div class="flex items-center gap-2 px-3 pt-3">
        <input
          v-if="mode === 'Reply'"
          v-model="subject"
          type="text"
          class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-medium text-ink-gray-9 placeholder:font-normal placeholder:text-ink-gray-4 focus:ring-0"
          placeholder="Subject"
        />
        <template v-else>
          <Avatar :label="currentUser.fullName" size="sm" />
          <span class="text-base font-medium text-ink-gray-9">
            {{ currentUser.fullName }}
          </span>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <div v-if="mode === 'Reply'" class="flex items-center gap-1">
            <Button
              label="Cc"
              :variant="showCc ? 'subtle' : 'ghost'"
              :aria-pressed="showCc"
              @click="showCc = !showCc"
            />
            <Button
              label="Bcc"
              :variant="showBcc ? 'subtle' : 'ghost'"
              :aria-pressed="showBcc"
              @click="showBcc = !showBcc"
            />
          </div>

          <Tooltip text="Collapse">
            <Button
              icon="lucide-chevrons-down-up"
              variant="ghost"
              @click="open = false"
            />
          </Tooltip>
        </div>
      </div>

      <ComposerEmailFields
        v-if="mode === 'Reply'"
        v-model:to="to"
        :show-cc="showCc"
        :show-bcc="showBcc"
      />

      <textarea
        ref="editor"
        v-model="body"
        class="min-h-[120px] w-full resize-none border-0 bg-transparent px-3 py-3 text-base text-ink-gray-8 placeholder:text-ink-gray-4 focus:ring-0"
        :placeholder="
          mode === 'Reply' ? 'Write a reply...' : 'Write a comment...'
        "
        @keydown.esc="open = false"
      />

      <div class="flex items-center gap-1 px-3 pb-3">
        <Button
          v-for="tool in TOOLS"
          :key="tool"
          :icon="tool"
          variant="ghost"
        />
        <Button class="ml-auto" label="Discard" @click="discard" />
        <Button label="Submit" variant="solid" :disabled="!body.trim()" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Avatar, Button, Dropdown, Tooltip } from 'frappe-ui'

import ComposerEmailFields from './ComposerEmailFields.vue'
import { currentUser, record } from './genericMock'

const MODES = ['Reply', 'Comment'] as const
const TOOLS = [
  'lucide-type',
  'lucide-at-sign',
  'lucide-smile',
  'lucide-image',
  'lucide-paperclip',
  'lucide-code',
]

// One create action per tab kind the record page can show.
const tabActions = [
  { label: 'Attach a file', icon: 'lucide-paperclip' },
  { label: 'Make a call', icon: 'lucide-phone' },
  { label: 'Create a task', icon: 'lucide-circle-check' },
  { label: 'Write a note', icon: 'lucide-notebook-pen' },
]

const open = ref(false)
const mode = ref<(typeof MODES)[number]>('Reply')
const body = ref('')
const to = ref(record.email)
const subject = ref(`Re: ${record.title}`)
const showCc = ref(false)
const showBcc = ref(false)
const editor = ref<HTMLTextAreaElement | null>(null)

async function expand(next: (typeof MODES)[number]) {
  mode.value = next
  open.value = true
  await nextTick()
  editor.value?.focus()
}

function discard() {
  body.value = ''
  open.value = false
}
</script>

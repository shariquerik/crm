<!-- The feed's band: three controls until one of them opens the editor for its mode. -->
<template>
  <div class="pointer-events-none mx-auto w-full max-w-3xl">
    <div v-if="!draft.open" class="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-base px-3 text-left text-base text-ink-gray-4 shadow-md hover:border-outline-gray-3"
        @click="expand('reply')"
      >
        <Avatar :label="userLabel" :image="currentUser.user_image" size="sm" />
        Reply to {{ docname }}
      </button>

      <Tooltip text="Add a comment">
        <button
          type="button"
          :class="ROUND_BUTTON"
          aria-label="Add a comment"
          @click="expand('comment')"
        >
          <span class="lucide-message-circle size-4" aria-hidden="true" />
        </button>
      </Tooltip>

      <Dropdown
        v-if="createOptions.length"
        :options="createOptions"
        side="top"
        placement="right"
      >
        <!-- The trigger must own the handlers and a box: Tooltip drops $attrs, and a
             display:contents wrapper would anchor the menu at 0,0. -->
        <div class="flex shrink-0">
          <Tooltip text="Add to this record">
            <button
              type="button"
              :class="ROUND_BUTTON"
              aria-label="Add to this record"
            >
              <span class="lucide-plus size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </Dropdown>
    </div>

    <div
      v-else
      class="pointer-events-auto relative flex flex-col rounded-xl border border-outline-gray-2 bg-surface-base shadow-lg"
    >
      <div class="flex items-center gap-2 px-3 pt-3">
        <template v-if="draft.mode === 'comment'">
          <Avatar
            :label="userLabel"
            :image="currentUser.user_image"
            size="sm"
          />
          <span class="text-base font-medium text-ink-gray-9">
            {{ userLabel }}
          </span>
        </template>
        <div class="ml-auto">
          <Tooltip text="Collapse">
            <Button
              icon="lucide-chevrons-down-up"
              variant="ghost"
              aria-label="Collapse"
              @click="collapse"
            />
          </Tooltip>
        </div>
      </div>

      <EmailComposer
        v-if="draft.mode === 'reply'"
        ref="composer"
        v-model="body"
        v-model:subject="subject"
        v-model:recipients="recipients"
        :header-fields="EMAIL_HEADER_FIELDS"
        :upload-function="uploadAttachment"
        placeholder="Write a reply…"
        submit-label="Send"
        @submit="send"
      />
      <CommentComposer
        v-else
        ref="composer"
        v-model="body"
        :mentions="mentionOptions"
        :upload-function="uploadAttachment"
        placeholder="Write a comment…"
        submit-label="Comment"
        @submit="send"
      />

      <div
        v-if="sending"
        class="absolute inset-0 grid place-content-center rounded-xl bg-surface-base/70"
      >
        <LoadingIndicator class="size-5 text-ink-gray-7" />
      </div>
    </div>

    <input
      ref="attachInput"
      type="file"
      class="hidden"
      @change="attachPicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import {
  Avatar,
  Button,
  Dropdown,
  LoadingIndicator,
  Tooltip,
  call,
  toast,
  useFileUpload,
} from 'frappe-ui'
import {
  CommentComposer,
  EmailComposer,
  type CommentPayload,
  type EmailPayload,
  type HeaderField,
} from '@framework/ui/components/Composer'
import type { FormLayoutSchema } from '@framework/ui/components/FormLayout'

import { useRestoredRef } from '@/composables/usePageState'
import {
  commentArgs,
  emailArgs,
  emptyDraft,
  openDraft,
  type ComposerMode,
  type ComposerRecord,
  type Draft,
} from '@/data/composer'
import { errorMessage } from '@/data/errors'
import { useRecordLayout } from '@/data/recordLayout'
import { currentUser, userLabel } from '@/data/session'
import { createActions, type CreateContext } from '@/data/tabTypes'
import { loadMentionOptions, mentionOptions } from '@/data/users'

const ROUND_BUTTON =
  'grid size-9 shrink-0 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2'
const EMAIL_HEADER_FIELDS: HeaderField[] = ['subject', 'to', 'cc', 'bcc']

const props = defineProps<{
  doctype: string
  docname: string
  doc: Record<string, any>
  layout: FormLayoutSchema
}>()

const draft = useRestoredRef<Draft>('composer', emptyDraft())

const body = draftField('body')
const subject = draftField('subject')
const recipients = draftField('recipients')

function draftField<Key extends keyof Draft>(key: Key) {
  return computed({
    get: () => draft.value[key],
    // Replaced whole: useRestoredRef watches the ref, so a nested write never persists.
    set: (value: Draft[Key]) =>
      (draft.value = { ...draft.value, [key]: value }),
  })
}

type ComposerCore = {
  focus: () => void
  reset: () => void
  editor?: { setEditable: (editable: boolean) => void }
}

const composer = ref<ComposerCore | null>(null)

const record = computed<ComposerRecord>(() => ({
  docname: props.docname,
  doc: props.doc,
  layout: props.layout,
}))

onMounted(loadMentionOptions)

function expand(mode: ComposerMode) {
  draft.value = openDraft(draft.value, mode, record.value)
  nextTick(() => composer.value?.focus())
}

function collapse() {
  draft.value = { ...draft.value, open: false }
}

const sending = ref(false)

// The response never reaches the feed: `docinfo_update` is its single writer.
async function send(payload: CommentPayload | EmailPayload) {
  if (sending.value || !addressed(payload)) return
  setEditable(false)
  try {
    warnUnsent(await post(payload))
    // The attachments live in the framework's editor, so only its reset clears them.
    composer.value?.reset()
    draft.value = emptyDraft()
    sending.value = false
  } catch (error: any) {
    toast.error(errorMessage(error))
    setEditable(true)
  }
}

// The overlay covers the card; the editor keeps focus, so it is stopped at the source.
function setEditable(editable: boolean) {
  sending.value = !editable
  composer.value?.editor?.setEditable(editable)
}

function post(payload: CommentPayload | EmailPayload) {
  const { doctype, docname } = props
  if (draft.value.mode !== 'reply')
    return call(
      'crm.api.comment.add_comment',
      commentArgs(doctype, docname, payload),
    )
  return call(
    'frappe.core.doctype.communication.email.make',
    emailArgs(doctype, docname, sender.value, payload as EmailPayload),
  )
}

const sender = computed(() => ({
  email: currentUser.value.email,
  fullName: currentUser.value.full_name || '',
}))

// A Communication with no recipients saves and sends to nobody, so the reply is stopped
// here instead.
function addressed(payload: CommentPayload | EmailPayload) {
  if (draft.value.mode !== 'reply') return true
  if ((payload as EmailPayload).recipients.to.length) return true
  toast.error('Add someone to reply to.')
  return false
}

function warnUnsent(response: any) {
  const addresses = response?.emails_not_sent_to
  if (addresses) toast.warning(`The email was not sent to ${addresses}.`)
}

const { upload } = useFileUpload()

// Loose: `add_comment` and `email.make` link the File to whatever they create. A reply's
// inline images load by URL for a reader outside the site, so they cannot be private.
function uploadAttachment(file: File) {
  return upload(file, { private: draft.value.mode !== 'reply' })
}

const { tabs } = useRecordLayout(() => props.doctype)

const attachInput = useTemplateRef<HTMLInputElement>('attachInput')

const context: CreateContext = { attach: () => attachInput.value?.click() }

const createOptions = computed(() =>
  createActions(tabs.value).map((action) => ({
    label: action.label,
    icon: action.icon,
    onClick: () => action.run(context),
  })),
)

// Nothing follows the upload: the attachment echo repaints the feed and the Files query.
async function attachPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await upload(file, {
      doctype: props.doctype,
      docname: props.docname,
      private: true,
    })
  } catch (error: any) {
    toast.error(errorMessage(error))
  }
}
</script>

<!-- The record's quick actions: the verbs worth a button. Laid out in a row, or
     vertically in the collapsed rail. -->
<template>
  <TooltipProvider :hover-delay="0" :skip-delay="0.5">
    <!-- Nothing may shrink: the row has to overflow for the fit to be measurable. -->
    <div
      ref="row"
      class="flex items-center gap-1 [&>*]:shrink-0"
      :class="vertical ? 'flex-col' : ''"
    >
      <!-- Named from the left while the width lasts; the rest keep to their tooltip. -->
      <template v-for="(action, index) in resolved.slice(0, visible)">
        <TagPicker
          v-if="action.tagging"
          :key="`${action.icon}-picker`"
          :doctype="doctype"
          :tags="chrome.tags"
          :vertical="vertical"
          @add="chrome.addTag"
          @remove="chrome.removeTag"
        />

        <!-- `icon` is what makes a Button icon-only; a named one takes `icon-left`.
             `label` goes on both: Button overwrites any `aria-label` with its own. -->
        <Tooltip
          v-else
          :key="action.icon"
          :text="action.label"
          :placement="placement"
          :disabled="index < labelled"
        >
          <Button
            :icon="index < labelled ? undefined : action.icon"
            :icon-left="index < labelled ? action.icon : undefined"
            :label="action.label"
            variant="subtle"
            @click="invoke(action)"
          />
        </Tooltip>
      </template>

      <!-- The anchor overlays the trigger, so the picker opens under the menu it came from. -->
      <div v-if="overflow.length" class="relative flex shrink-0">
        <Dropdown :options="overflow" side="bottom" align="end">
          <div class="flex shrink-0">
            <Tooltip text="More quick actions" :placement="placement">
              <Button
                icon="lucide-more-horizontal"
                label="More quick actions"
                variant="subtle"
              />
            </Tooltip>
          </div>
        </Dropdown>

        <TagPicker
          v-if="taggingOverflowed"
          v-model:open="picking"
          anchored
          :doctype="doctype"
          :tags="chrome.tags"
          @add="chrome.addTag"
          @remove="chrome.removeTag"
        />
      </div>
    </div>

    <FileUploadDialog
      v-if="dialogMounted"
      v-model:open="dialogOpen"
      title="Attach files"
      multiple
      :transport="transport"
      @committed="chrome.reloadFiles"
    />
  </TooltipProvider>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  inject,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, Tooltip, TooltipProvider } from 'frappe-ui'

import { recordTransport } from '@/data/attachments'

import TagPicker from '@/components/record/TagPicker.vue'
import type { ComposerMode } from '@/data/composer'
import { requestComposer } from '@/data/composerRequest'
import type { RecordChrome } from '@/data/docinfo'
import { RecordPageKey } from '@/data/pageContext'
import { printUrl } from '@/data/recordActions'
import { useFittedActions } from '@/composables/useFittedActions'
import {
  ACTIVITY_TAB,
  EMAILS_TAB,
  RECORD_TABS,
  hasComposer,
} from '@/data/recordLayout'

const props = defineProps<{
  doctype: string
  docname: string
  chrome: RecordChrome
  vertical?: boolean
}>()

// Lazily mounted: the uploader and its cropper load only when attaching.
const FileUploadDialog = defineAsyncComponent(
  () => import('@framework/ui/components/FileUpload/FileUploadDialog.vue'),
)

const dialogMounted = ref(false)
const dialogOpen = ref(false)

const route = useRoute()
const router = useRouter()

const placement = computed(() => (props.vertical ? 'left' : 'top'))

const picking = ref(false)

type QuickAction = {
  name: string
  icon: string
  label: string
  description?: string
  run?: (page?: any) => void
  tagging?: boolean
}

// Tagging comes last, so it is the first thing the row gives up. A tagged record has
// the chips' own "+" instead.
const builtins = computed<QuickAction[]>(() => [
  {
    name: 'email',
    icon: 'lucide-mail',
    label: 'Compose email',
    description: 'Compose an email',
    run: writeEmail,
  },
  {
    name: 'comment',
    icon: 'lucide-message-circle',
    label: 'Add comment',
    description: 'Add a comment',
    run: addComment,
  },
  {
    name: 'attach',
    icon: 'lucide-paperclip',
    label: 'Attach',
    description: 'Attach a file',
    run: attach,
  },
  {
    name: 'print',
    icon: 'lucide-printer',
    label: 'Print',
    description: 'Print',
    run: print,
  },
  ...(props.chrome.tags.length
    ? []
    : [
        {
          name: 'tags',
          icon: 'lucide-tag',
          label: 'Tags',
          description: 'Tags',
          tagging: true,
          run: () => (picking.value = true),
        },
      ]),
])

const controller = inject(RecordPageKey, null)
controller?.quickActions.provideBuiltins(() => builtins.value)

const resolved = computed<QuickAction[]>(() =>
  controller
    ? (controller.quickActions.visible() as QuickAction[])
    : builtins.value,
)

function invoke(action: QuickAction) {
  action.run?.(controller?.page)
}

// The rail has no width to spend, so it names nothing and hides nothing.
const row = useTemplateRef<HTMLElement>('row')
const { labelled, visible } = useFittedActions(
  row,
  () => resolved.value.length,
  () => !props.vertical,
)

const overflow = computed(() =>
  resolved.value.slice(visible.value).map((action) => ({
    label: action.label,
    icon: action.icon,
    onClick: () => invoke(action),
  })),
)

const taggingOverflowed = computed(() =>
  resolved.value.slice(visible.value).some((action) => action.tagging),
)

function writeEmail() {
  openComposer('reply', EMAILS_TAB)
}

function addComment() {
  openComposer('comment', ACTIVITY_TAB)
}

// The tab only changes when the one in view carries no composer to serve the request.
function openComposer(mode: ComposerMode, tab: string) {
  requestComposer(mode)
  const tabs = controller?.tabs.visible() ?? RECORD_TABS
  if (!hasComposer(tabs, route.query.tab as string | undefined))
    router.replace({ query: { ...route.query, tab } })
}

const transport = computed(() => recordTransport(props.doctype, props.docname))

function attach() {
  dialogMounted.value = true
  dialogOpen.value = true
}

// The dialog closes itself once every row lands, and takes its cropper with it.
watch(dialogOpen, (open) => {
  if (!open) dialogMounted.value = false
})

function print() {
  window.open(printUrl(props.doctype, props.docname), '_blank')
}
</script>

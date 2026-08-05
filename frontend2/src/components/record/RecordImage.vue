<!-- The record's picture: click to upload or replace, hover to clear it.
     With none set, the tile carries the record's initials and a camera to add one. -->
<template>
  <div class="group relative size-20 shrink-0">
    <!-- The tile clips the picture itself, so it meets the rounded edge on every side. -->
    <div
      class="size-20 overflow-hidden rounded-[10px] bg-surface-gray-1 ring-1 ring-outline-gray-2"
    >
      <img
        v-if="image && !broken"
        :src="image"
        :alt="label"
        class="size-full object-cover"
        @error="broken = true"
      />
      <div
        v-else
        class="grid size-full select-none place-items-center text-8xl uppercase text-ink-gray-4"
      >
        {{ initials }}
      </div>
    </div>

    <LoadingIndicator
      v-if="uploading"
      class="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-ink-gray-6"
    />

    <div
      v-else-if="image"
      class="absolute inset-0 flex items-center justify-center gap-1 rounded-[10px] bg-black-overlay-400 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
    >
      <button
        class="grid size-6 place-items-center rounded text-white hover:bg-white-overlay-300"
        aria-label="Replace image"
        @click.stop="attach"
      >
        <span class="lucide-camera size-4" aria-hidden="true" />
      </button>
      <button
        class="grid size-6 place-items-center rounded text-white hover:bg-white-overlay-300"
        aria-label="Remove image"
        @click.stop="emit('update', '')"
      >
        <span class="lucide-trash-2 size-4" aria-hidden="true" />
      </button>
    </div>

    <button
      v-else
      class="absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center rounded-b-[10px] bg-black-overlay-50 pb-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      aria-label="Add image"
      @click.stop="attach"
    >
      <span class="lucide-camera size-4 text-ink-gray-6" aria-hidden="true" />
    </button>

    <FileUploadDialog
      v-if="dialogMounted"
      v-model:open="dialogOpen"
      title="Attach image"
      :multiple="false"
      image-only
      crop
      progress-mode="field"
      @uploading="onUploading"
      @committed="onCommitted"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { LoadingIndicator } from 'frappe-ui'
import type { UploadResult } from '@framework/ui/components/FileUpload'

// Lazily mounted: the uploader and its cropper load only when attaching.
const FileUploadDialog = defineAsyncComponent(
  () => import('@framework/ui/components/FileUpload/FileUploadDialog.vue'),
)

const props = defineProps<{
  label: string
  image: string
}>()

const emit = defineEmits<{ update: [url: string] }>()

const broken = ref(false)
const dialogMounted = ref(false)
const dialogOpen = ref(false)
const uploading = ref(false)

const initials = computed(() =>
  props.label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join(''),
)

function attach() {
  dialogMounted.value = true
  dialogOpen.value = true
}

// The tile shows the spinner while bytes move, so the modal steps out of the way.
function onUploading(value: boolean) {
  uploading.value = value
  if (value) dialogOpen.value = false
}

function onCommitted(results: UploadResult[]) {
  const [uploaded] = results
  if (uploaded) {
    emit('update', uploaded.file_url)
    dialogMounted.value = false
  } else {
    dialogOpen.value = true
  }
}

// A real close unmounts; the programmatic one taken while uploading only hides.
watch(dialogOpen, (open) => {
  if (!open && !uploading.value) dialogMounted.value = false
})

watch(
  () => props.image,
  () => (broken.value = false),
)
</script>

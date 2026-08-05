<!-- Renders nothing until the record has a tag; from then on it carries its own "+". -->
<template>
  <div v-if="chrome.tags.length" class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="tag in chrome.tags"
      :key="tag"
      class="group/tag flex items-center gap-1.5 rounded-full border border-outline-gray-2 py-0.5 pl-2 pr-1 text-sm text-ink-gray-7"
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="tagColor(tag)"
        aria-hidden="true"
      />
      {{ tag }}
      <button
        type="button"
        class="grid size-4 place-content-center rounded-full text-ink-gray-4 opacity-0 transition hover:bg-surface-gray-3 hover:text-ink-gray-8 focus-visible:opacity-100 group-hover/tag:opacity-100"
        :aria-label="`Remove ${tag}`"
        @click="chrome.removeTag(tag)"
      >
        <span class="lucide-x size-3" aria-hidden="true" />
      </button>
    </span>

    <TagPicker
      chip
      :doctype="doctype"
      :tags="chrome.tags"
      @add="chrome.addTag"
      @remove="chrome.removeTag"
    />
  </div>
</template>

<script setup lang="ts">
import TagPicker from '@/components/record/TagPicker.vue'
import type { RecordChrome } from '@/data/docinfo'
import { tagColor } from '@/data/tags'

defineProps<{ doctype: string; chrome: RecordChrome }>()
</script>

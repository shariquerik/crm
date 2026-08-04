<!-- PROTOTYPE — throwaway. Renders nothing until the record has a tag; from then on it
     carries its own "+", and the strip's tag icon steps aside. -->
<template>
  <div v-if="recordTags.length" class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="tag in recordTags"
      :key="tag"
      class="flex items-center gap-1.5 rounded-full border border-outline-gray-2 px-2 py-0.5 text-sm text-ink-gray-7"
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="tagColor(tag)"
        aria-hidden="true"
      />
      {{ tag }}
    </span>

    <TagPicker chip />
  </div>
</template>

<script setup lang="ts">
import TagPicker from './TagPicker.vue'
import { recordTags, tagColor } from './tagState'
</script>

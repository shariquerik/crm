<!-- PROTOTYPE — throwaway. One labelled line of the email envelope. -->
<template>
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="w-8 shrink-0 text-base text-ink-gray-5">{{ label }}:</span>
    <input
      v-model="value"
      type="text"
      class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 placeholder:text-ink-gray-4 focus:ring-0"
      :placeholder="placeholder"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; placeholder?: string }>()

const value = defineModel<string>({ default: '' })
</script>

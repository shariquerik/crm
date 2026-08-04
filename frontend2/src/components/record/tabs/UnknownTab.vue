<!-- The tab a stored `type` names but nothing here backs. -->
<template>
  <div class="flex min-h-0 flex-1 items-center justify-center p-6">
    <p class="text-base text-ink-gray-5">
      “{{ item.label || item.type }}” cannot be shown here.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { TabProps } from '@/data/tabTypes'

defineProps<TabProps>()
</script>

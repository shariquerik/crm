<!-- PROTOTYPE — throwaway. Overlapping avatars for the people assigned to a record. -->
<template>
  <div class="flex items-center">
    <Avatar
      v-for="(item, index) in items"
      :key="item.fullName"
      class="ring-2 ring-surface-base"
      :class="index ? '-ml-1.5' : ''"
      :label="item.fullName"
      size="sm"
    />
  </div>
</template>

<script setup lang="ts">
import { Avatar } from 'frappe-ui'

defineProps<{ items: { fullName: string }[] }>()
</script>

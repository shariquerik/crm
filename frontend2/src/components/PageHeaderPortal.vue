<template></template>

<script setup lang="ts">
import { onUnmounted, useSlots } from 'vue'

import { pageHeader } from '@/data/pageHeader'

const slots = useSlots()
const owner = Symbol('page-header')

if (slots.default) pageHeader.value = { owner, slot: slots.default }

// Routing mounts the incoming page before unmounting the outgoing one, so a
// page may only clear a header it still owns.
onUnmounted(() => {
  if (pageHeader.value?.owner === owner) pageHeader.value = null
})
</script>

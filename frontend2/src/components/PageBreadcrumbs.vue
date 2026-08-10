<template>
  <Breadcrumbs :items="items">
    <template #prefix="{ item }">
      <ViewIcon v-if="'icon' in item" :icon="item.icon" class="mr-1.5" />
    </template>
  </Breadcrumbs>
</template>

<script setup lang="ts">
import { Breadcrumbs } from 'frappe-ui'
import { ViewIcon } from '@framework/ui/experimental'

defineProps<{ items: any[] }>()
</script>

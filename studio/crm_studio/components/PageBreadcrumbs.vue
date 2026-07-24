<!-- frappe-ui's Breadcrumbs draws labels only. This wraps it to prefix each crumb with
  its icon, so the view crumb carries the same marker it shows in the sidebar. A view
  crumb is marked by carrying an `icon` key at all — an empty one still renders, letting
  ViewIcon fall back to the list glyph exactly as the sidebar does. The doctype and
  record crumbs omit the key and render label-only. -->
<template>
  <Breadcrumbs :items="items">
    <template #prefix="{ item }">
      <ViewIcon v-if="'icon' in item" :icon="item.icon" class="mr-1.5" />
    </template>
  </Breadcrumbs>
</template>

<script setup lang="ts">
import { Breadcrumbs } from 'frappe-ui'
import { ViewIcon } from '@framework/ui/components/SavedViews'

defineProps<{ items: any[] }>()
</script>

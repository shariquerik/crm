<template>
  <FrappeUIProvider>
    <AppShell class="h-full min-h-0 w-full">
      <!-- Resources read their route params once at setup, so a path change must
           remount the page. Keyed on path, not fullPath: saved-view tweaks
           rewrite the query. -->
      <router-view :key="route.path" />
    </AppShell>
  </FrappeUIProvider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { FrappeUIProvider } from 'frappe-ui'

import AppShell from '@/components/AppShell.vue'
import { loadCurrentUser } from '@/data/session'

const route = useRoute()

onMounted(loadCurrentUser)
</script>

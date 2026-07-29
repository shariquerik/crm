<template>
  <FrappeUIProvider>
    <!-- Resources read their route params once at setup, so a path change must remount
         the page. Keyed on path, not fullPath: saved-view tweaks rewrite the query. -->
    <router-view :key="route.path" />
  </FrappeUIProvider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { FrappeUIProvider } from 'frappe-ui'

import { loadCurrentUser } from '@/data/session'

const route = useRoute()

onMounted(loadCurrentUser)
</script>

<template>
  <div class="h-full" />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'

import { railHomeRoute } from '@/data/rail'
import { railItems } from '@/data/railLayout'

const router = useRouter()

watch(
  railItems,
  (items) => {
    const route = railHomeRoute(items)
    if (route) router.replace(route)
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="flex h-full w-full flex-1 flex-col items-center justify-center gap-2 p-6"
  >
    <p class="text-xl font-semibold text-ink-gray-8">Page not found</p>
    <p class="text-base text-ink-gray-6">
      {{ doctype }} is not a doctype you can open here.
    </p>
    <Button
      class="mt-2"
      label="Go to home"
      variant="subtle"
      @click="router.push('/')"
    />
  </div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { useRouter } from 'vue-router'

defineProps<{ doctype: string }>()

const router = useRouter()
</script>

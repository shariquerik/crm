<template>
  <div class="flex h-full flex-col pb-0 p-8 gap-8 overflow-hidden">
    <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
      {{ __('Plans') }}
    </h2>
    <div v-if="!data.get.loading" class="flex-1 overflow-y-auto"></div>
    <div v-else class="flex flex-1 items-center justify-center">
      <Spinner class="size-8" />
    </div>
  </div>
  <div class="flex flex-row-reverse text-sm px-6 py-4 text-gray-600">
    {{ __('Powered by Frappe Cloud') }}
  </div>
</template>
<script setup>
import { Spinner } from 'frappe-ui'
import { ref } from 'vue'

const data = ref({
  get: {
    loading: false,
  },
})
</script>

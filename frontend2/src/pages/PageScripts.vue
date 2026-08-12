<!-- Direct access to a doctype's page scripts, away from any record. -->
<template>
  <div class="flex w-full min-h-0 flex-1 flex-col gap-4 p-6">
    <div>
      <h1 class="text-lg font-semibold text-ink-gray-9">Page scripts</h1>
      <p class="text-p-sm text-ink-gray-5">
        Customizations that run on every {{ doctypeLabel(doctype) }} record
        page.
      </p>
    </div>
    <PageScriptEditor
      :dt="doctype"
      editorHeight="32rem"
      class="min-h-0 flex-1"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PageScriptEditor } from '@framework/ui/experimental'

import { doctypeLabel } from '@/data/doctypes'

const route = useRoute()
const doctype = computed(() => route.params.doctype as string)
</script>

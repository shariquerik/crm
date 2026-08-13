<!-- Direct access to a doctype's page scripts, away from any record. The pane
     carries its own header and footer (wayfinder ticket 23), so this route adds
     nothing around it but the room to fill. -->
<template>
  <div class="flex min-h-0 w-full flex-1 flex-col">
    <PageScriptEditor :dt="doctype" class="min-h-0 flex-1" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PageScriptEditor } from '@framework/ui/experimental'

const route = useRoute()
const doctype = computed(() => route.params.doctype as string)
</script>

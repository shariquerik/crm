<template>
  <NavigationEditorDialog v-model="open" flat :navigation="railNavigation" />
</template>

<script setup lang="ts">
import { NavigationEditorDialog } from '@framework/ui/components/Navigation'

import { railNavigation } from '@/data/railLayout'

const open = defineModel<boolean>({ default: false })
</script>

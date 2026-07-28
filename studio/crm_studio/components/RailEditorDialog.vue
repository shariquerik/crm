<template>
  <NavigationEditorDialog
    v-model="open"
    flat
    :navigation="railNavigation"
    :itemKinds="ITEM_KINDS"
  />
</template>

<script setup lang="ts">
import { NavigationEditorDialog } from '@framework/ui/components/Navigation'

import { ITEM_KINDS } from '@app/data/itemKinds'
import { railNavigation } from '@app/data/railLayout'

const open = defineModel<boolean>({ default: false })
</script>

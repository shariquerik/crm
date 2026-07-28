<!-- The rail's half of the shared editor dialog: the app-scope navigation, drawn flat
  because the rail shows no section boundaries. Everything else — the window, the error
  line, the scope select — is the framework's, the same one the docked sidebar opens. -->
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

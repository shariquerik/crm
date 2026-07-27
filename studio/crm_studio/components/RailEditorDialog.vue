<template>
  <Dialog v-model="open" size="xs" title="Customize sidebar">
    <template #body-content>
      <NavigationSidebarEditor
        flat
        :navigation="railNavigation"
        :canManageShared="railNavigation.canManageShared.value"
        :itemKinds="ITEM_KINDS"
        @error="error = errorMessage($event)"
      />
      <ErrorMessage class="mt-2" :message="error" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, ErrorMessage } from 'frappe-ui'
import { NavigationSidebarEditor } from '@framework/ui/components/Navigation'
import { ref } from 'vue'

import { errorMessage } from '@app/data/errors'
import { ITEM_KINDS } from '@app/data/itemKinds'
import { railNavigation } from '@app/data/railLayout'

const open = defineModel<boolean>({ default: false })

const error = ref('')
</script>

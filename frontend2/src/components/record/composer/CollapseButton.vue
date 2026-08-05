<!-- The composer card's collapse control, shared by its reply and comment headers. -->
<template>
  <!-- The wrapper carries class and the button carries the handler: Tooltip drops $attrs. -->
  <div class="flex shrink-0">
    <Tooltip text="Collapse">
      <Button
        icon="lucide-chevrons-down-up"
        variant="ghost"
        aria-label="Collapse"
        @click="emit('collapse')"
      />
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'

const emit = defineEmits<{ collapse: [] }>()
</script>

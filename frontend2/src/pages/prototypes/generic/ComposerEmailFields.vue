<!-- PROTOTYPE — throwaway. Who a reply goes to. The subject sits in the composer's header,
     where a comment shows its author, so this holds recipients only. -->
<template>
  <div class="flex flex-col gap-3 px-3 py-2">
    <ComposerField v-model="to" label="To" placeholder="Recipients" />

    <ComposerField
      v-if="showCc"
      v-model="cc"
      label="Cc"
      placeholder="Recipients"
    />

    <ComposerField
      v-if="showBcc"
      v-model="bcc"
      label="Bcc"
      placeholder="Recipients"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import ComposerField from './ComposerField.vue'

// The header owns the Cc/Bcc switches: they read as composer chrome, not as a recipient.
const props = defineProps<{ showCc?: boolean; showBcc?: boolean }>()

const to = defineModel<string>('to', { default: '' })

const cc = ref('')
const bcc = ref('')

// A row switched off means nobody is copied, so it cannot keep recipients out of sight.
watch(
  () => props.showCc,
  (shown) => shown || (cc.value = ''),
)
watch(
  () => props.showBcc,
  (shown) => shown || (bcc.value = ''),
)
</script>

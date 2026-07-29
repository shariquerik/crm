<template>
  <kbd class="font-sans text-base text-ink-gray-4">{{ label }}</kbd>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const GLYPHS: Record<string, string> = {
  cmd: '⌘',
  mod: '⌘',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
}

const props = defineProps<{ keys: string[] }>()

const label = computed(() =>
  props.keys.map((key) => GLYPHS[key] ?? key).join(''),
)
</script>

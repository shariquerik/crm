// PROTOTYPE — throwaway. Module-scope so the chips and the picker share one list.
import { ref } from 'vue'

const startEmpty = new URLSearchParams(location.search).get('tags') === '0'

export const recordTags = ref<string[]>(
  startEmpty ? [] : ['champion', 'decision-maker'],
)

export const knownTags = [
  'champion',
  'decision-maker',
  'blocker',
  'inbound',
  'q3-target',
  'renewal',
]

// A saturated dot on a neutral chip. Tinted chip fills need a different text token per
// theme to stay legible; a 500-level dot reads on both without one.
const PALETTE = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-red-500',
]

/** Colour follows the tag's name, so the same tag looks the same on every record. */
export function tagColor(tag: string): string {
  let hash = 0
  for (const character of tag) hash = (hash * 31 + character.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}

export function addTag(tag: string) {
  if (tag && !recordTags.value.includes(tag))
    recordTags.value = [...recordTags.value, tag]
}

export function removeTag(tag: string) {
  recordTags.value = recordTags.value.filter((each) => each !== tag)
}

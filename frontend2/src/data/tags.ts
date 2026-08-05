/** The record's tags: what `docinfo` carries, and what the picker offers against it. */

const PALETTE = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-red-500',
]

/** The record's own tags. `getdoc` joins them with commas; a list passes through. */
export function tagsOf(docinfo: Record<string, any>): string[] {
  const tags = docinfo?.tags ?? ''
  const names = Array.isArray(tags) ? tags : String(tags).split(',')
  return names.map((tag) => String(tag).trim()).filter(Boolean)
}

export function matchingTags(known: string[], query: string): string[] {
  const wanted = normalize(query)
  return known.filter((tag) => normalize(tag).includes(wanted))
}

export function canCreateTag(known: string[], query: string): boolean {
  const wanted = normalize(query)
  return Boolean(wanted) && !known.some((tag) => normalize(tag) === wanted)
}

/** Colour follows the tag's name, so the same tag looks the same on every record. */
export function tagColor(tag: string): string {
  let hash = 0
  for (const character of tag)
    hash = (hash * 31 + character.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}

function normalize(text: string) {
  return text.trim().toLowerCase()
}

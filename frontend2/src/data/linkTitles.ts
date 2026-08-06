/** What the records this app has loaded are called, keyed `Doctype::name`. */
// `getdoc` answers with the titles of everything the document links to, which is the only
// place they arrive. The oldest fall out past the cap, and a miss reads as the record's ID.
import { ref } from 'vue'

const MAX_TITLES = 200

const titles = ref(new Map<string, string>())

export function rememberLinkTitles(painted: Record<string, string>) {
  const kept = new Map(titles.value)
  for (const [key, title] of Object.entries(painted)) {
    kept.delete(key)
    kept.set(key, title)
  }
  while (kept.size > MAX_TITLES) kept.delete(oldestKey(kept))
  titles.value = kept
}

export function linkTitle(doctype: string, name: string) {
  return titles.value.get(`${doctype}::${name}`) || name
}

function oldestKey(kept: Map<string, string>) {
  return kept.keys().next().value as string
}

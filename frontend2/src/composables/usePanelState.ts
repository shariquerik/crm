// The record panel's own state: how wide it is, whether it is a rail, and which of one
// doctype's sections are open. All three survive a reload; none of them is a customization.
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type {
  FormLayoutSchema,
  Section,
} from '@framework/ui/components/FormLayout'

export const MIN_WIDTH = 320
export const MAX_WIDTH = 640
export const DEFAULT_WIDTH = 420
export const COLLAPSE_AT = 260
export const REOPEN_DISTANCE = 40
export const SNAP_DISTANCE = 7
export const RAIL_WIDTH = 48

export function usePanelState(
  doctype: string,
  layout: MaybeRefOrGetter<FormLayoutSchema>,
) {
  const storedWidth = useLocalStorage('crm-panel-width', DEFAULT_WIDTH)
  const collapsed = useLocalStorage('crm-panel-collapsed', false)
  const divergences = useLocalStorage<Record<string, boolean>>(
    `crm-panel-sections:${doctype}`,
    {},
  )

  const sections = computed(() => sectionsOf(toValue(layout)))

  const width = computed({
    get: () => clampWidth(storedWidth.value),
    set: (value: number) => (storedWidth.value = clampWidth(value)),
  })

  const openSections = computed({
    get: () => openState(sections.value, divergences.value),
    set: (open: Record<string, boolean>) =>
      (divergences.value = divergencesOf(sections.value, open)),
  })

  return { width, collapsed, openSections }
}

/** What a drag on the edge amounts to: a new width, a toggle, or neither yet. */
export function dragOutcome(
  open: boolean,
  startWidth: number,
  distance: number,
): { width?: number; toggle?: boolean } {
  if (!open) return distance >= REOPEN_DISTANCE ? { toggle: true } : {}
  const width = startWidth + distance
  // A drag that ends in a collapse commits no resize, so the rail reopens at the width
  // it had before the drag squashed it against the minimum.
  if (width < COLLAPSE_AT) return { width: clampWidth(startWidth), toggle: true }
  return { width: snapToDefault(clampWidth(width)) }
}

/** A drag that passes close to the default width settles on it. */
export function snapToDefault(width: number) {
  const offset = Math.abs(width - DEFAULT_WIDTH)
  return offset <= SNAP_DISTANCE ? DEFAULT_WIDTH : width
}

/** Clamped on read as well as on drag, so a hand-edited value cannot escape the range. */
export function clampWidth(width: number) {
  if (!Number.isFinite(width)) return DEFAULT_WIDTH
  return Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH)
}

/** An effective boolean for every section: the layout's default under what diverged. */
export function openState(
  sections: Section[],
  divergences: Record<string, boolean>,
) {
  const open: Record<string, boolean> = {}
  for (const section of sections) {
    const key = sectionKey(section)
    if (key) open[key] = divergences[key] ?? opensByDefault(section)
  }
  return open
}

/** Only the sections that differ, so a default an admin later changes still wins. */
export function divergencesOf(
  sections: Section[],
  open: Record<string, boolean>,
) {
  const diverged: Record<string, boolean> = {}
  for (const section of sections) {
    const key = sectionKey(section)
    if (key && Boolean(open[key]) !== opensByDefault(section))
      diverged[key] = Boolean(open[key])
  }
  return diverged
}

function sectionsOf(layout: FormLayoutSchema) {
  return (layout || []).flatMap((tab) => tab.sections || [])
}

// The name a saved layout stores. A doctype without one mints a fresh name per request,
// so nothing persists there and the layout's defaults win each load.
function sectionKey(section: Section) {
  return section.name ?? section.label ?? ''
}

function opensByDefault(section: Section) {
  return section.opened !== false
}

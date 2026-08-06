<!-- The seam between the rail and the sidebar: drag toward the rail to collapse, drag back
     out to reopen, click for the same toggle the round chevron gives. -->
<template>
  <div
    class="absolute inset-y-0 z-10 w-2 -translate-x-1/2 transition-[left] duration-300 ease-in-out"
    :class="open ? 'cursor-w-resize' : 'cursor-e-resize'"
    :style="{ left: offset }"
    aria-hidden="true"
    @click="onClick"
    @pointerdown.prevent="onPointerDown"
  />

  <button
    type="button"
    class="absolute bottom-1/3 z-20 flex size-6 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-5 shadow-sm transition-[left,opacity,background-color] duration-300 ease-in-out hover:bg-surface-gray-2 focus-visible:opacity-100 focus-visible:focus-ring"
    :class="
      !open && railHovered
        ? 'opacity-100'
        : 'opacity-0 group-hover/sidebar:opacity-100'
    "
    :style="{ left: offset }"
    :aria-label="open ? 'Collapse sidebar' : 'Expand sidebar'"
    :aria-expanded="open"
    @click="emit('toggle')"
  >
    <span
      class="lucide-chevron-left size-4 transition-transform duration-300 ease-in-out"
      :class="{ 'rotate-180': !open }"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  offset: string
  railHovered: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()

/** How far the seam travels before the drag counts as a collapse or a reopen. */
const DRAG_DISTANCE = 40

let startX = 0
let dragged = false

function onPointerDown(event: PointerEvent) {
  startX = event.clientX
  dragged = false
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function onPointerMove(event: PointerEvent) {
  const distance = event.clientX - startX
  if (props.open && Math.abs(distance) > 2) dragged = true
  if (!passesThreshold(distance)) return
  dragged = true
  emit('toggle')
  stopDrag()
}

/** The sidebar has no width to resize, so a drag either toggles it or amounts to nothing. */
function passesThreshold(distance: number) {
  return props.open ? distance <= -DRAG_DISTANCE : distance >= DRAG_DISTANCE
}

function stopDrag() {
  window.removeEventListener('pointermove', onPointerMove)
}

// A drag that already toggled must not toggle again on its closing click.
function onClick() {
  if (!dragged) emit('toggle')
}
</script>

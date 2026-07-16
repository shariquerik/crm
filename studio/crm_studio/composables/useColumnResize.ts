import { computed, reactive, ref, type Ref } from 'vue'

const CHECKBOX_TRACK = '2rem'
const MIN_COLUMN_WIDTH = 60

export function useColumnResize(options: {
  columns: Ref<any[]>
  emit: (event: any, payload: any) => void
}) {
  const { columns, emit } = options

  const widthOverride = reactive<Record<string, string>>({})
  const resizingKey = ref<string | null>(null)
  let drag: { key: string; startX: number; startWidth: number } | null = null

  const listColumns = computed(() => {
    const tracks = columns.value.map(trackFor)
    const hasFlexible = tracks.some((track) => track.includes('fr'))
    if (!hasFlexible) tracks.push('minmax(0, 1fr)')
    return [CHECKBOX_TRACK, ...tracks].join(' ')
  })

  function trackFor(column: any) {
    const width = widthOverride[column.key] ?? column.width
    if (width == null) return 'minmax(0, 1fr)'
    return typeof width === 'number' ? `${width}fr` : String(width)
  }

  function startResize(column: any, event: MouseEvent) {
    const cell = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-slot='list-header-cell']",
    )
    if (!cell) return
    drag = {
      key: column.key,
      startX: event.clientX,
      startWidth: cell.getBoundingClientRect().width,
    }
    resizingKey.value = column.key
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', endDrag)
  }

  function onDrag(event: MouseEvent) {
    if (!drag) return
    const width = Math.max(
      MIN_COLUMN_WIDTH,
      drag.startWidth + (event.clientX - drag.startX),
    )
    widthOverride[drag.key] = `${Math.round(width)}px`
  }

  function endDrag() {
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', endDrag)
    resizingKey.value = null
    if (!drag) return
    const { key } = drag
    const width = widthOverride[key]
    delete widthOverride[key]
    drag = null
    if (width) emit('column-resize', { key, width })
  }

  function resetColumn(column: any) {
    delete widthOverride[column.key]
    emit('column-reset', { key: column.key })
  }

  return { listColumns, resizingKey, startResize, resetColumn }
}

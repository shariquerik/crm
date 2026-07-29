import { computed, type Ref } from 'vue'

export function useRowSelection(options: {
  selection: Ref<string[]>
  rows: Ref<any[]>
  rowKey: Ref<string>
}) {
  const { selection, rows, rowKey } = options

  const allKeys = computed(() =>
    rows.value.map((row) => String(row[rowKey.value])),
  )

  const selectAllState = computed<'none' | 'some' | 'all'>(() => {
    const selected = allKeys.value.filter((key) =>
      selection.value.includes(key),
    ).length
    if (!selected) return 'none'
    return selected === allKeys.value.length ? 'all' : 'some'
  })

  function toggle(value: string) {
    selection.value = selection.value.includes(value)
      ? selection.value.filter((key) => key !== value)
      : [...selection.value, value]
  }

  function toggleSelectAll() {
    if (selectAllState.value === 'all') {
      const universe = new Set(allKeys.value)
      selection.value = selection.value.filter((key) => !universe.has(key))
    } else {
      selection.value = [...new Set([...selection.value, ...allKeys.value])]
    }
  }

  return { selectAllState, toggle, toggleSelectAll }
}

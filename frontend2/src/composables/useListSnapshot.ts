import { computed, watch } from 'vue'
import { snapshotByRoute } from '@/data/listCache'

export function useListSnapshot(props: {
  rows: any[]
  columns: any[]
  loading: boolean
  cacheKey: string
}) {
  const snapshot = computed(() => {
    if (!props.loading || props.rows.length || !props.cacheKey) return undefined
    return snapshotByRoute.get(props.cacheKey)
  })

  const rows = computed(() =>
    props.rows.length ? props.rows : (snapshot.value?.rows ?? []),
  )

  const columns = computed(() => {
    if (snapshot.value) return snapshot.value.columns
    if (props.columns.length) return props.columns
    return snapshotByRoute.get(props.cacheKey)?.columns ?? []
  })

  const hasLiveCounts = computed(() => props.rows.length > 0)

  watch(
    [() => props.rows, () => props.columns],
    ([rowsValue, columnsValue]) => {
      if (rowsValue.length && columnsValue.length && props.cacheKey)
        snapshotByRoute.set(props.cacheKey, {
          rows: rowsValue,
          columns: columnsValue,
        })
    },
  )

  return { rows, columns, hasLiveCounts }
}

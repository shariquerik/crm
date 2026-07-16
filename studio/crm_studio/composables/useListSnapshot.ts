// Stale-while-revalidate for a list: Studio tears the page's resources down on every
// navigation, so `rows` empties for the whole swap even when the data is already known.
// The last rendered rows per route stand in until the fresh ones land.

import { computed, watch } from 'vue'
import { snapshotByRoute } from '@app/data/listCache'

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
    props.rows.length ? props.rows : snapshot.value?.rows ?? [],
  )

  // Columns must come from whichever source the rows did: the live prop still holds the
  // previous route's columns while a snapshot stands in, and would misalign the cells.
  const columns = computed(() => {
    if (snapshot.value) return snapshot.value.columns
    if (props.columns.length) return props.columns
    return snapshotByRoute.get(props.cacheKey)?.columns ?? []
  })

  // A snapshot carries no counts, so the footer's tallies can't read from `rows`.
  const hasLiveCounts = computed(() => props.rows.length > 0)

  // Rows can land a beat before the columns binding does — never store that torn pair, or
  // the fallback above reads back empty columns.
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

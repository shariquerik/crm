# Slice 05 — `RecordFeed` and Activity

**Leaves working:** Activity is real, first in the strip, and opens by default.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Tabs** and **Data** before starting.

The eleven-bucket assembly is the only genuinely new work on the page.

## When it lands

Opening a record lands on Activity: comments, field changes, emails, views, shares, likes, workflow,
assignment, attachment and info logs, milestones, and the synthetic created and edited entries, in
one time-ordered feed, in a centred `max-w-3xl` column. It fades where content passes under the tab
strip and under the bottom of the feed, and a single scroll button appears when the feed overflows,
swapping `↓` for `↑` at the halfway point. Switching to Details and back returns to the same scroll
offset, and so does leaving the record and coming back. A comment posted by someone else appears
without a refresh.

## Files

**Created:**

- `src/components/record/RecordFeed.vue` — the scroller, both fades and the scroll button.
  **Without the composer band**: the band arrives in slice 07 with the composer inside it, because
  no boundary may show a stub.
- `src/components/record/tabs/ActivityTab.vue` — the bucket assembly, wrapping `RecordFeed`.
- `src/composables/useScrollEdges.ts` — graduated from the prototype unchanged.

**Also edits:** `src/data/recordLayout.ts`, to put `activity` first in `RECORD_TABS`;
`src/data/tabTypes.ts`, to add its entry.

Activity costs zero fetches. `docinfo` is already on the page from slice 04.

## Decisions it implements

- [What backs Activity, Emails and Files](../wayfinder/tickets/001-feed-data-sources.md) — the
  eleven buckets, and why Activity is an assembly rather than an endpoint. Desk does the same at
  `form_timeline.js:162`; `crm.api.activities.get_activities` is Lead- and Deal-only and its shape
  is not worth copying.
- [The tab contract](../wayfinder/tickets/004-tab-contract.md) — scroll restored from page state
  keyed `scroll:${item.name}`, and the first tab opening with no stored default.
- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — each feed
  tab wraps `RecordFeed` and fills its slot, so Details gets no band without any component testing
  for one.

## Prototype

- `src/pages/prototypes/generic/GenericTimeline.vue:37-110` — the scroller, the `max-w-3xl` column,
  the row shapes for a comment and a log entry, and both gradient fades.
- `GenericTimeline.vue:112-139` — the scroll button in the band's right gutter, its tooltip and its
  arrow swap at `pastHalf`.
- `useScrollEdges.ts` — copy it whole; `atTop`, `atBottom`, `overflowing` and `pastHalf` are all
  used here.

## Framework surface

None.

## Traps

None specific to this slice. The `isolate` root from slice 03 is what keeps `RecordFeed`'s `z-10`
band out of a dialog overlay's way in slice 07.

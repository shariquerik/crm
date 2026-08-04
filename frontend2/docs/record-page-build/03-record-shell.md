# Slice 03 — the shell and a one-tab strip

**Leaves working:** the page shell with one tab — Details — holding today's form.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **The tree**, **Who owns what** and
**Tabs** before starting.

A seam not routed through once is a seam only written down, so this slice routes `resolveTab`, the
`RECORD_TABS` literal, `?tab=` and per-tab scroll through a real tab.

## When it lands

`/:doctype/:id` shows a header carrying breadcrumbs and Save, a tab strip with one entry — Details —
and the doctype's full form under it. Clicking the tab writes `?tab=details` without adding a
history entry, Back leaves the record, and reloading on that URL lands on the same tab. A URL with
an unknown `?tab=` value shows Details and leaves the URL alone.

## Files

**Created:**

- `src/components/record/RecordHeader.vue`
- `src/components/record/RecordTabs.vue`
- `src/components/record/tabs/DetailsTab.vue`
- `src/components/record/tabs/UnknownTab.vue`
- `src/data/tabTypes.ts`
- `src/data/recordLayout.ts`

**Also edits:** `src/pages/Record.vue`, whose template is rewritten to the `isolate` container
holding `<RecordHeader>` and `<RecordTabs>`; `RecordPanel` joins it in slice 08.

`RecordHeader` is a component rather than markup inlined in the portal slot, because slice 04's
assignment menu mutates `docinfo` through its own endpoint. It takes props and emits `save`. **It
carries no status pill** — a generic record page cannot know which field is the status, so the
header reads `docinfo` and `isDirty` and writes nothing to the doc.

## Decisions it implements

- [The tab contract](../wayfinder/tickets/004-tab-contract.md) — `TabProps`, `resolveTab`, the
  mounting rule, the day-one list and the `RECORD_TABS` literal.
- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — the
  header without a status pill, `?tab=` on `replace`, and `layout` joining the tab props.

## Prototype

- `src/pages/prototypes/generic/GenericRecordPrototype.vue:6-8` — the `isolate` root and its
  comment.
- `GenericTimeline.vue:4-31` — the tab strip: the underlined active state, the icon-and-label
  button, the border.
- `GenericHeader.vue:4-30` — the header row's layout. Drop the status `Button` at lines 17-26.

`GenericForm.vue` is **not** a target for `DetailsTab`. It reused the panel's grid only because the
prototype had no real controls; the Details tab is `FormLayout` as `Detail.vue` already renders it.

## Framework surface

`FormLayout`, mounted by `DetailsTab` with `v-model:doc` and the `layout` prop. It calls
`resolveLayout(schema, doc)` internally, so nothing is hoisted.

## Traps

- **`isolate` on `Record.vue`'s root container.** A `Dialog`'s overlay carries `z-index: auto`, so
  the page's positive z-index layers — the composer band at `z-10` in slice 07, the seam at `z-20`
  in slice 08 — would paint over it and stay lit while the rest of the page dims. The container must
  enclose both. This is why the page has a root container rather than a fragment.

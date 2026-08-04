# Slice 08 — the panel frame

**Leaves working:** the panel holds every field, resizable and collapsible.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Who owns what**, **Saving** and **What
the framework supplies** before starting.

**Needs the frappe branch from slice 01.** If that branch is late, the build stops at slice 07 and
waits — there is no app-local panel renderer, not even temporarily.

## When it lands

The record page gains a right-hand column at 380px holding every field in collapsible sections,
label left and value right. Section headers pin below one another as the panel scrolls. Clicking a
value opens a control in place that writes to the same doc and the same dirty state the Details tab
edits. Dragging the seam resizes between 320 and 640px; dragging past 260px collapses it to a rail;
a 40px drag back reopens it. Width, the collapsed flag and which sections are open all survive a
reload, and the width is right at first paint with no animation from a default. Saving over a
colleague's concurrent edit to the same field opens a dialog naming them and offering a per-field
choice.

## Files

**Created:**

- `src/components/record/RecordPanel.vue` — a two-root fragment, `<PanelEdge>` then `<aside>`, which
  calls `usePanelState(doctype)` itself.
- `src/components/record/PanelEdge.vue`
- `src/components/record/SaveConflictDialog.vue`
- `src/composables/usePanelState.ts`

**Also edits:** `src/pages/Record.vue`, whose `isolate` container gains `<RecordPanel>`;
`src/composables/useRecordPage.ts`, whose 409 branch stops toasting a non-empty collision set and
opens the dialog instead.

`RecordIdentity`, `RecordActions`, `RecordTags`, `TagPicker` and `ShareDialog` are slice 09. This
slice's `aside` holds the fields and nothing above them.

## Decisions it implements

- [Where the side panel's fields come from](../wayfinder/tickets/003-side-panel-fields.md) — what a
  row renders, click-to-edit, and the fieldtypes that show a summary with a trailing `↗`.
- [Where the panel's own state is kept](../wayfinder/tickets/008-panel-state-persistence.md) — the
  three `localStorage` keys, the divergence-only format for open sections, and first-visit
  behaviour.
- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — why
  `RecordPanel` owns `usePanelState` and the header has no collapse control.
- [What a save does when the record moved underneath it](../wayfinder/tickets/010-save-conflict-recovery.md)
  — the dialog: its wording, the theirs-per-field default, `Discard my changes`, Escape leaving the
  merged state dirty, and a colliding child table as one row picked whole.

## Prototype

- `src/pages/prototypes/generic/PanelEdge.vue:1-81` — the whole seam: the `w-resize` strip, the
  drag, the collapse threshold, the reopen distance, the round chevron, and the closing-click guard.
- `GenericRecordPrototype.vue:18-68` — the `aside`, its `transition-[width] duration-300`, the
  `dragging` suppression, the 48px rail, and the bottom fade over the scrolling sections.

## Framework surface

`PanelLayout` from slice 01, with `v-model:doc` and `v-model:openSections`. It calls `resolveLayout`
internally, and reaches `useFieldTypes().resolve` and `formatField` itself.

## Traps

- **`PanelEdge` sits at `z-20`.** It is inside slice 03's `isolate` container, which is what keeps
  it from painting over a dialog overlay.
- **`PanelLayout` never sees a width.** Width belongs to the `aside`, which slice 09 fills with
  things that are not `PanelLayout`'s.
- **Only divergences from the layout's `opened` are stored**, keyed by `section.name`. Writing the
  matching value instead of deleting the entry would silently override an admin who later changes a
  default. On a doctype with no saved layout the generated names change per request, so nothing
  persists and the defaults win each load — that is the intended failure.
- **Clamp the stored width on read as well as on drag**, so a stale or hand-edited value cannot
  escape 320–640.

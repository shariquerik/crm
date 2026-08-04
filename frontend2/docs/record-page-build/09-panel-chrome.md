# Slice 09 — the panel's chrome

**Leaves working:** the whole designed shape.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Who owns what** and **The traps** before
starting.

**Needs the frappe branch from slice 01**, through the panel it decorates.

This is the least coherent slice in the plan — five components held together by "in the panel, not a
field" — and the first candidate if a slice wants splitting during the build.

## When it lands

Above the panel's fields sits an identity block that never scrolls: avatar, title, subtitle, the
record's tags, and a row of quick actions ending in `⋯`. Tags can be added and removed, and the row
appears only once the record has one. The overflow menu holds Follow, Copy link, Copy ID, Duplicate
and Delete. Share opens a dialog listing who the record is shared with and how many people follow
it. Collapsing the panel to the rail keeps the same quick actions, laid out vertically from the same
component.

## Files

**Created:**

- `src/components/record/RecordIdentity.vue`
- `src/components/record/RecordActions.vue`
- `src/components/record/RecordTags.vue`
- `src/components/record/TagPicker.vue`
- `src/components/record/ShareDialog.vue`

**Also edits:** `src/components/record/RecordPanel.vue`, whose `aside` gains the identity block and
whose rail gains the vertical actions; `src/composables/useDocinfo.ts`, for the tag, like and follow
mutations — each ships with the control that fires it.

## Decisions it implements

- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — the five
  names and what each owns.
- [Who owns the doc and its dirty state](../wayfinder/tickets/002-doc-state-ownership.md) —
  `docinfo` mutating through its own endpoints, never through `Save`.
- `record-page.md:44` and `:52` — quick actions are the doctype's to configure, so nothing
  structural may sit in the strip; Delete is not a quick action; and the rail renders the same
  actions from one component so a doctype's configured set follows it in.

## Prototype

- `src/pages/prototypes/generic/RecordIdentity.vue:3-22` — the headline block and its border.
- `RecordActions.vue:4-45` — the action row, the `vertical` variant for the rail, the tooltip
  placement swap, and the overflow menu's contents.
- `TagRow.vue:4-19` — the tag chips and the `+` that only appears once there is a tag.
- `TagPicker.vue:4-68` — the popover, its search line, the checkbox rows and the create action.
- `ShareDialog.vue:4-36` — the dialog body, the shared-with list and the follower count line.

## Framework surface

None directly. This slice sits above `PanelLayout` in the same `aside`.

## Traps

- **`Tooltip` drops `$attrs` in a `Dropdown` trigger**, so `RecordActions`' `⋯` needs a boxed
  wrapper taking the trigger props. `GenericComposer.vue:25-38` is the working shape; the prototype's
  own `RecordActions.vue:34-39` is not, and must not be copied as-is.
- **`Dialog` gives initial focus to its first tabbable element**, the close button, so it opens
  wearing a focus ring. Mark the field you want focused `autofocus` — the dialog checks for it in
  `open-auto-focus` and stands down. Racing it with a `setTimeout` does not work. Binds `ShareDialog`
  and `TagPicker`.
- **`bg-surface-white` is not generated in this app's Tailwind build.** It fails silently, leaving
  floating surfaces transparent. Use `bg-surface-base`.

# Slice 10 — delete the prototype

**Leaves working:** everything slice 09 left working, byte-identical.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth.

One commit of pure deletion. The prototype dies when no ticket still cites it — every building
ticket does, so a deletion-only ticket passes that test by construction. Hanging this off slice 09
would break the rule that makes it checkable.

## When it lands

`/:doctype/:id` is unchanged. `/prototype/record/:doctype` is a 404.

## Files

**Deleted:**

- `src/pages/prototypes/generic/` — all twenty files: `AvatarGroup.vue`,
  `ComposerEmailFields.vue`, `ComposerField.vue`, `dirtyState.ts`, `GenericComposer.vue`,
  `GenericForm.vue`, `GenericHeader.vue`, `genericMock.ts`, `GenericRecordPrototype.vue`,
  `GenericTimeline.vue`, `PanelEdge.vue`, `PanelFieldSection.vue`, `PeopleControl.vue`,
  `RecordActions.vue`, `RecordIdentity.vue`, `ShareDialog.vue`, `TagPicker.vue`, `TagRow.vue`,
  `tagState.ts`, `useScrollEdges.ts`.
- The `src/pages/prototypes/` directory itself.

**Also edits:** `src/router.ts`, dropping the `/prototype/record/:doctype` route and its comment.

Before deleting, confirm the test holds: nothing outside `src/pages/prototypes/` imports from it,
and no ticket in this folder still cites it.

## Decisions it implements

- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — the
  deletion in one commit, and the condition it is contingent on.

## Prototype

None, and that is the point. A ticket that cited it could not be the last one.

## Framework surface

None.

## Traps

None.

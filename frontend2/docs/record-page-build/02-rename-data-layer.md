# Slice 02 — the rename and the data layer

**Leaves working:** the page looks identical and saves through the new endpoint.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **The tree**, **Who owns what**, **Data**
and **Saving** before starting.

This slice changes no markup, and that is its value. A save regression after this commit bisects to
a commit that touched no component.

## When it lands

`/:doctype/:id` renders exactly what it renders today — `FormLayout`, a Save button, the same
breadcrumbs. Behind it: the record arrives by `getdoc`, an edit and a Save round-trips through
`frappe.client.save`, the first save does not light thirty fields dirty, and a save against a record
someone else has moved retries silently once and otherwise toasts.

## Files

**Moved:**

- `src/pages/Detail.vue` → `src/pages/Record.vue` (template unchanged in this slice)
- `src/composables/useDetailPage.ts` → `src/composables/useRecordPage.ts`
- `src/components/ListSurface.vue`, `ListFooter.vue`, `ListBulkBar.vue` →
  `src/components/list/`

**Created:** none. Every file this slice touches already exists.

**Also edits:** `src/data/resources.ts` (`detailResources` → `recordResources`, `resources.record` →
`resources.docResource`, `frappe.client.get` → `frappe.desk.form.load.getdoc`, the save path, the
`_link_titles` map), `src/composables/usePageState.ts` (`useScrollRestore` takes a `name`,
defaulting to `'scrollTop'`), `src/router.ts` (route name `Detail` → `Record`), and `src/pages/
List.vue` for the moved imports.

`fieldDiff`, the `painted` watch guard and the `fetchCached` wiring move across verbatim. Nothing
else in `useDetailPage` survives. `data/fieldsLayout.ts` does not move.

## Decisions it implements

- [Who owns the doc and its dirty state](../wayfinder/tickets/002-doc-state-ownership.md) — the
  owner's API surface, the self-healing diff, and the rename table.
- [What a save actually costs](../wayfinder/tickets/009-save-endpoint-cost.md) — the endpoint, and
  the four things the page must handle.
- [What a save does when the record moved underneath it](../wayfinder/tickets/010-save-conflict-recovery.md)
  — the refetch, the two diffs and the single retry. **The dialog is slice 08, not this one**; a
  non-empty collision set toasts here.
- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — the
  placement rule that moves the list's three files.

## Prototype

None. This slice writes no markup, so it cites nothing to lift.

## Framework surface

Unchanged: `Record.vue` still renders `FormLayout`, which calls `resolveLayout` internally.

## Traps

- **`getdoc` returns its payload on `frappe.response.docs` and `docinfo`, not on `message`.**
  frappe-ui's `call()` only copes because `docs` is present; calling `get_docinfo` on its own
  through frappe-ui returns `undefined`.
- **Null against missing.** `getdoc` omits nulls via `as_dict(no_nulls=True)`; every save endpoint
  returns them. `fieldDiff` compares `JSON.stringify`, so without normalizing, the first save marks
  thirty fields dirty.
- **Send the whole document.** Measured: dropping a child table deleted all its rows, dropping a
  field nulled it.

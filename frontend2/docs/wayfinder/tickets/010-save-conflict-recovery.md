---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariq
blocked_by: [009-save-endpoint-cost.md]
status: closed
---

# What a save does when the record moved underneath it

## Question

[What a save actually costs](009-save-endpoint-cost.md) put `save()` on
`frappe.client.save`, which detects a concurrent edit where today's `set_value` silently
clobbers it. That is the point of the change — but it means the record page now has a failure
the current page has never shown, and nobody has designed it.

The server raises `TimestampMismatchError` (`document.py:1399-1405`), arriving as HTTP 409 with
`exc_type: "TimestampMismatchError"`. It already reaches `errorMessage`, but in framework
wording: *"… has been modified after you have opened it … Please refresh to get the latest
document."* That is desk's sentence, and it assumes a page the user can simply reload.

Decide:

- **What the user is told**, in product wording rather than framework wording.
- **What the user can do about it.** Reload and lose the edit is the cheap answer. Reload and
  reapply is possible because the page holds the diff — `changedFields()` is exactly the set to
  replay — but it silently overwrites whatever the other person just wrote to those same fields.
  A field-level merge is the honest answer and the expensive one.
- **Where it appears.** `saveError` renders as an `ErrorMessage` above the form today
  (`Detail.vue:17`), which is nowhere near the panel where most editing happens, and the Details
  tab may not even be the open tab.
- **Whether the panel's click-to-edit changes the calculus.** A panel edit is one field, so
  "reapply my one change" is a far smaller claim than replaying a whole form.

Two smaller things from the same resolution, decided here because they share the moment:

- **`_link_titles` go stale after a save.** No save endpoint returns them
  ([record-save-cost.md](../../research/record-save-cost.md)), so a Link field the user just
  changed shows its old title until the next `getdoc`. Accept the stale title, refetch, or
  render the raw value?
- **The panel and the Details tab edit one doc.** If a save fails, both surfaces are showing
  unsaved state. Does anything mark them, or does the error carry it alone?

## Read first

Paths are relative to `frontend2/` unless absolute.

- [../map.md](../map.md), then the resolutions of
  [Who owns the doc and its dirty state](002-doc-state-ownership.md) and
  [What a save actually costs](009-save-endpoint-cost.md).
- `docs/research/record-save-cost.md` — the measured behaviour, especially "What the page has to
  handle".
- `/Users/shariq/crm-bench/apps/frappe/frappe/model/document.py:1379-1409` — `check_if_latest`,
  the exact error and its wording.
- `src/data/errors.ts` (`errorMessage`) and `src/pages/Detail.vue:17` — how a save error surfaces
  today.
- `docs/record-page.md` — "Saving is explicit" (line 28) for the constraint this must not break.

## How to resolve

`/grilling`. The three recovery options are not equally honest — bring the cost of each rather
than presenting them flat, and be concrete about what "reapply" does to the other person's write.

Consider `/prototype` if the wording and placement are hard to judge in the abstract.

## The answer must say

- The exact message the user sees, and where on the page it appears.
- What recovery the user is offered, and what it does to a concurrent edit of the same field.
- What happens to `_link_titles` after a save.
- Whether either editing surface marks itself when a save has failed.

## Resolution

The page recovers by **three-way merge**, not by reloading. It already holds two of the three
versions — the fetched baseline in `docResource.data` and the user's edits in `doc` — so one
`getdoc` brings the third and the collision set is computable client-side, with no server support
the page does not have today.

### The recovery path

`save()` calls `client.save({ doc })`. On HTTP 409 with `exc_type: "TimestampMismatchError"` —
and on nothing else; every other failure takes the toast path below:

1. **Refetch by `getdoc`.** One call brings the server's current document, fresh `_link_titles`,
   and `docinfo.user_info`, which carries `modified_by` (`load.py:528-530`). The other person is
   named for free; no second call identifies them.
2. **Diff twice against the fetched baseline.** `changedFields()` is *mine*; the same `fieldDiff`
   against the refetched document is *theirs*. The collision set is the intersection of their
   keys.
3. **Empty collision set — reapply and retry once.** Replay mine onto their document and re-issue
   `client.save`. Success toasts *"Saved. Jane Doe also edited this record while you were
   working."* A second 409 falls through to step 4 rather than retrying again.
4. **Non-empty — reapply what does not collide, then open the dialog** with mine showing in the
   colliding fields.

The empty set is the common case: a panel click-to-edit save is one field, and two people editing
that same field inside one open-record window is rare. So the conflict is invisible where it costs
nothing, and spends UI only on the case `client.save` was adopted to catch.

**Retrying does not break "saving is explicit"** (`record-page.md:28`). The user pressed Save; one
retry completes the action they asked for rather than starting one they did not. The cap at one
kills the loop.

### The dialog

```
┌──────────────────────────────────────────────────┐
│  Jane Doe edited this record while you were      │
│  working                                          │
│                                                   │
│  You both changed 2 fields. Pick which values     │
│  to keep.                                         │
│                                                   │
│  Deal value                                       │
│   ○ Yours    ₹65,000                              │
│   ● Jane's   ₹50,000                              │
│                                                   │
│  Products                                         │
│   ○ Yours    12 rows                              │
│   ● Jane's   10 rows                              │
│                                                   │
│      [ Discard my changes ]  [ Save ]             │
└──────────────────────────────────────────────────┘
```

**It never says "refresh".** The page has already refetched by the time it opens, which is what
separates it from desk's sentence (`document.py:1399-1405`). It names the person rather than the
record: this is a human problem whose real fix is usually to go ask Jane, and naming her makes
that possible while taking the blame off a user who did nothing wrong.

**A modal, because the decision blocks the save** and because the colliding field may sit in a
collapsed panel section or on the Details tab while Activity is open. Inline marking has no single
place to stand when two collisions cross two surfaces; the dialog is the one place both fit.

- **Default is theirs, per field.** An accidental `Save` then never destroys a write the user
  never saw. The cost is that a user who wants their own values clicks every row.
- **`Save`** applies the choices and re-saves. Another 409 reopens the dialog on the new set.
- **`Discard my changes`** drops the diff entirely and leaves the refetched record clean.
- **Escape closes on the merged, still-dirty state.** The user can then read the Activity feed on
  this same page to see what Jane did, and the next `Save` reopens the dialog because nothing was
  resolved. Trapping them would be wrong precisely because "go look at what changed" is the sane
  response. Applying the theirs-default on dismiss was rejected: it discards the user's edit
  without them pressing anything.

**A colliding child table is one row in the dialog, picked whole** — `Yours — 12 rows` against
`Jane's — 10 rows`. `TableField.vue` means the Details tab can dirty a table, and `client.save`
replaces the whole table anyway (measured: dropping `products` deleted all 200 rows), so
whole-table is the grain the payload actually has. Row-level merge is a nested copy of this
dialog, bought for a case rarer than the scalar collision already called rare.

### `_link_titles`

**A map on `useRecordPage`, seeded from `getdoc` and written on every Link pick.** No save
endpoint is asked for titles, so the endpoint choice does not bend for this.

Nothing in `frontend2` or `@framework/ui` reads `_link_titles` today: `Link.vue` resolves its
display label from the `search_link` options resource (`Link.vue:113-118`), so the *editor* never
needed the map. It is needed only for the panel's **read state**, which renders a value rather
than a combobox — `PanelLayout`, still unbuilt.

That narrows the stale-title case to Link fields the user just changed, and they changed them by
picking from a combobox that handed back `{ value, label }` at pick time. Writing
`Doctype::value → label` into the map at that moment costs one line and leaves no stale title. A
key missing for any other reason — set by a server hook, say — **renders the raw name**: ugly,
never a lie. The conflict path gets fresh titles free, because its refetch is a `getdoc`.

### Other save errors, and marking

**Toast only.** The inline `ErrorMessage` above the form (`Detail.vue:17`) is dropped rather than
moved. It sits inside one of four tabs, so it renders where nobody is looking as often as not, and
duplicates the toast when it does. `saveError` survives as composable state with no renderer.
Frappe's save errors are document-level HTML msgprints; there is no field to sit beside.

**Neither editing surface marks itself after a failure.** The record staying dirty with `Save` lit
is already a persistent marker that the write did not land. A `saveFailedFields` set would be
state to invalidate on the next edit, the next save and the dialog's reapply — three chances to
strand a red field — and would spend exactly what the self-healing diff in
[Who owns the doc and its dirty state](002-doc-state-ownership.md) bought. The dialog is the
exception that proves the rule: it marks fields, but only while open, and computes them fresh from
a diff rather than storing them.

### Accepted costs

Recorded rather than solved, both observable only under a real concurrent edit:

- After a silent retry, the user's write lands on a record whose other fields moved without them
  seeing either value. The toast names the fact; it does not show the change.
- A child-table collision is judged on row counts alone.

### What this adds to the build

One component, `SaveConflictDialog.vue` in `src/components/record/` — fourteen files where
[The component seams](005-component-seams.md) counted thirteen, still inside AGENTS.md's fifteen.
Everything else is `useRecordPage`: the 409 branch, the two diffs, the retry, and the
`_link_titles` map.

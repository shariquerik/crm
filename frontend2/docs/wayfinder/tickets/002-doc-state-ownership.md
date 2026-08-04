---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariquerik
blocked_by: []
status: closed
---

# Who owns the doc and its dirty state

## Question

`record-page.md:28` fixes the constraint: the side panel and the Details tab edit **one doc**
and share **one dirty state**, and `Save` appears in the header only while that state is dirty.
Read-only fields never dirty it. Three surfaces, one source.

Alongside the doc sits `docinfo` — assignment, tags, share, follow, attachments — which
`record-page.md:57` says comes from `getdoc` and is not layout-configurable. The header reads
assignees from it; the panel reads tags; the Share dialog reads followers and shared-with.

Decide:

- What holds the doc — a `useRecordPage` composable returning it, a provide/inject at the page
  root, or a store keyed by doctype and name.
- How dirtiness is computed, and what makes a field read-only for that purpose.
- Whether `docinfo` rides in the same owner or a second one, given it mutates through its own
  endpoints rather than through `Save`.
- What `Detail.vue`'s existing `useDetailPage` and `detailResources` get to keep. The recent
  cache work — `open a record from cache` (cd8abef6) — set a convention worth not breaking.

## Read first

Paths are relative to `frontend2/`.

- [../map.md](../map.md), then this ticket.
- `docs/record-page.md` — "Saving is explicit" (line 28) and "Document chrome comes from one
  source" (line 57) are the two constraints. "The full form is a tab, not a mode" (line 33)
  says why there are two editing surfaces at all.
- `src/pages/Detail.vue` — 63 lines, the whole of what exists today.
- `src/composables/useDetailPage.ts`, `src/data/resources.ts` (`detailResources`),
  `src/data/fieldsLayout.ts` — the current owner, such as it is.
- `src/composables/usePageState.ts` and `src/data/cache/` — the convention set by cd8abef6.
  Run `git show cd8abef6` for the reasoning.
- `src/composables/useListPage.ts` — the sibling page's answer to the same shape of problem.
  Worth matching unless there is a reason not to.
- Reference only, do not move: `src/pages/prototypes/generic/dirtyState.ts`,
  `GenericForm.vue`, `GenericHeader.vue`, `GenericRecordPrototype.vue`.

## How to resolve

`/grilling`. The prototype's `dirtyState.ts` is a working answer to part of this — put its
approach to the human as a candidate rather than starting from nothing.

## The answer must say

- The owner, and its exact API surface — what a component calls to read the doc, edit a field,
  and learn whether anything is dirty.
- How that owner reaches the header, the side panel and the Details tab, and why that mechanism
  over the alternatives.
- How dirtiness is computed, and the rule that makes a field read-only for that purpose.
- Where `docinfo` lives, given it mutates through its own endpoints rather than through `Save`.
- What happens to `useDetailPage` and `detailResources` by name.

## Resolution

### The owner

`useRecordPage(resources)`, one composable called once in `Record.vue`, matching the
`useListPage(resources)` convention exactly. Its API surface:

| Returns | What it is |
| --- | --- |
| `doc` | `Ref<Record<string, any>>`, the edited document. Bound as `v-model:doc`. |
| `isDirty` | `computed`, true while the diff is non-empty. |
| `changedFields()` | The diff itself, and the save payload. |
| `save()`, `saving`, `saveError` | The save action and its state. |
| `breadcrumbs` | As today. |
| `...useDocinfo(docResource)` | Spread, see below. |

No component calls an `update(fieldname, value)` on the owner. `FormLayout` and `PanelLayout`
each take `v-model:doc` and provide `DocKey` / `UpdateKey` to their own fields
(`FormLayout.vue:44`, `95-96`), so field writes land on the shared ref through the surface
component. The owner exposes the doc, not a setter.

### How the owner reaches the three surfaces

Three surfaces, three mechanisms, and the reason is structural rather than preference:

- **The header, by slot closure.** `PageHeaderPortal` is not a Teleport — it stashes the slot
  function in a module-scope ref (`PageHeaderPortal.vue:11`) and the app shell renders it. Slot
  *bindings* close over the page's setup scope, which is why `Detail.vue:8` can bind
  `:loading="saving"` today. A component inside that slot calling `inject()` would resolve
  against the shell's tree instead, so **provide/inject cannot serve the header**. Anything the
  header needs must sit in `Record.vue`'s setup scope.
- **The panel and the Details tab, by `v-model:doc`.** Both surface components provide `DocKey`
  downward themselves, so nothing is prop-drilled past the surface boundary.
- **`docinfo` consumers, by props from `Record.vue`** — the header's assignees, the panel's tags,
  the Share dialog's followers and shared-with.

Page-root provide/inject was rejected because it solves only two of the three and would leave the
page running two mechanisms where one suffices. A store keyed by doctype and name was rejected
because it inherits an eviction problem for unsaved edits that a page-scoped composable does not
have.

### Dirtiness, and the read-only rule

Keep the diff. `isDirty` is derived from `fieldDiff(doc.value, docResource.data)` — the existing
`useDetailPage.ts:115-125`, carried over verbatim — and the same call produces the save payload,
so there is one source for "what changed" and no flag to forget to clear. It self-heals: edit a
value and edit it back, and `Save` disappears again. The cost is a JSON comparison per edit.

**The owner holds no read-only rule at all.** `resolveLayout` already bakes `readOnly`, including
`read_only_depends_on`, onto every field node; the surfaces refuse to open a control for such a
field; so a read-only field is never written and never enters the diff.
`record-page.md:31`'s "Read-only fields never dirty it" is satisfied without the owner knowing
anything about the layout. That ignorance is the point — the owner stays a doc owner, not a
layout consumer.

The `painted` watch guard (`useDetailPage.ts:40-54`) carries over unchanged: a cached record
paints first and the fetched one lands behind it, and typing in that window must not be
overwritten. So does the `fetchCached` wiring from cd8abef6.

### docinfo

`useDocinfo(docResource)`, a sub-composable that `useRecordPage` composes and spreads — the same
shape as `useListPage` composing `useViewState`, `useCreateDoc` and `useBulkDelete`.

It reads its buckets off the shared `getdoc` response rather than fetching, because
`docinfo` arrives in the same payload as the doc (see
[What backs Activity, Emails and Files](001-feed-data-sources.md)). It owns the `docinfo_update`
realtime subscription and the assign, tag, like and follow mutations, all of which go through
their own endpoints.

**`docinfo` never touches `isDirty` or `save`.** It is not part of the document being edited, so
it does not belong in the diff. Keeping it in a sibling composable rather than in `useRecordPage`
keeps eleven buckets, a realtime subscription and four mutation endpoints out of the owner.

### What `save()` calls — settled by measurement, after this ticket closed

Deferred here and resolved by
[What a save actually costs, set_value against savedocs](009-save-endpoint-cost.md), which
measured a fourth candidate neither this ticket nor that one had named: **`save()` calls
`frappe.client.save({ doc })`**, sending the whole document and repainting from the response
rather than reloading. The owner's API surface above is unchanged.

Two amendments it makes to this resolution:

- **`changedFields()` is no longer the save payload**, only the dirty check and the
  yet-to-be-designed recovery replay. `client.save` takes the whole document; a trimmed payload
  deletes child rows, which is measured rather than theoretical.
- **`fieldDiff` must normalize null against missing.** `getdoc` omits nulls via
  `as_dict(no_nulls=True)`; every save endpoint returns them explicitly. Left alone, the first
  save repaints the baseline with thirty null keys the fetched record never had, and
  `JSON.stringify(null) !== JSON.stringify(undefined)` marks all thirty dirty.

The new failure mode it introduces — `TimestampMismatchError`, which today's `set_value`
structurally cannot raise — is
[What a save does when the record moved underneath it](010-save-conflict-recovery.md).

### What happens by name

`CONTEXT.md:8-11` defines **Record page** and lists *Avoid: Detail page, form page*, so the
rewrite drops the proscribed term rather than carrying it forward:

| Today | After |
| --- | --- |
| `src/pages/Detail.vue` | deleted |
| — | `src/pages/Record.vue` |
| `src/composables/useDetailPage.ts` | deleted |
| — | `src/composables/useRecordPage.ts` |
| — | `src/composables/useDocinfo.ts` |
| `detailResources()` | `recordResources()` |
| `resources.record` | `resources.docResource` |
| router route name `Detail` | `Record` |

`recordResources` keeps the shape of `detailResources` but swaps `frappe.client.get` for
`frappe.desk.form.load.getdoc` (`resources.ts:33`), which is what unlocks `docinfo` and all three
feeds at once. The resource is renamed `docResource` so it does not read like the `record`
variable it sits beside. It also gains the `File` list query that Files needs for its timestamps,
and the `get_communications` pager that Emails needs — both established by
[What backs Activity, Emails and Files](001-feed-data-sources.md).

`fieldDiff`, the `painted` watch guard and the `fetchCached` calls move across verbatim. Nothing
else in `useDetailPage` survives.

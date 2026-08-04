---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariquerik
blocked_by:
  [
    002-doc-state-ownership.md,
    003-side-panel-fields.md,
    004-tab-contract.md,
    008-panel-state-persistence.md,
  ]
status: closed
---

# Component seams, names and file layout

## Question

Name every component the record page is built from, say what each owns, and put it somewhere.

The prototype's 20 files under `src/pages/prototypes/generic/` are one answer to this, arrived
at while discovering the shape. Read them for what the seams cost, then draw the seams the
rewrite deserves — the prototype's boundaries were never the point.

Settle:

- The component tree, and where it lives. The page shell, header, tab strip, feed, composer,
  side panel, section, seam.
- Which of those are generic and which are record-page-specific — i.e. what belongs in
  `src/components/` versus alongside the page.
- The rename. `Detail.vue` becomes `Record.vue`, and `useDetailPage` and `detailResources`
  follow. [CONTEXT.md:8](../../../CONTEXT.md) already made this call — "Record page", _Avoid:
  Detail page_ — so this is applying a decision, not making one. Confirm what the new names are
  and what else moves with them.
- Which of the four traps in [record-page.md:117](../../record-page.md) constrain a seam rather
  than a line. The `isolate` root and the stacking context are structural; the rest may not be.

The output of this ticket is most of the build doc's first half.

## Read first

Paths are relative to `frontend2/`.

- [../map.md](../map.md), then this ticket.
- **All three tickets that blocked this one**, resolutions included:
  [Who owns the doc and its dirty state](002-doc-state-ownership.md),
  [Where the side panel's fields come from](003-side-panel-fields.md),
  [The tab contract](004-tab-contract.md). Those answers constrain the seams; this ticket draws
  the remaining lines, it does not revisit theirs.
- `AGENTS.md` — the layout, build, formatting and comment rules for this app. Binding.
- `CONTEXT.md` in full. Every component name this ticket invents has to agree with it.
- `docs/record-page.md` — the whole document, but especially the four traps (line 117), which
  is the part that constrains structure rather than styling.
- The existing app for house style: `src/pages/List.vue` and `src/pages/Detail.vue`,
  `src/components/` (note what earns a place there — `AppShell.vue`, `ListSurface.vue`,
  `ListFooter.vue`), and `src/composables/`.
- Reference only, do not move: the whole of `src/pages/prototypes/generic/` — 20 files. Read
  them for what the seams cost, not for what the seams should be.

## How to resolve

`/grilling`, plus `/codebase-design` for the seam vocabulary and `/code-style` for anything
about file size or shape. Come with a proposed tree; a blank page makes a bad interview.

## The answer must say

- The component tree, each node named and given one sentence on what it owns.
- Where each file goes, and the rule that decides `src/components/` versus alongside the page.
- The new names for `Detail.vue`, `useDetailPage` and `detailResources`, plus anything else the
  rename drags along.
- Which of the four traps constrain a seam rather than a line, and which seam each one binds.
- What the prototype route's deletion is contingent on.

## Resolution

### The placement rule

**Shared by two or more pages → `src/components/`. Owned by one page → `src/components/<page>/`.**

`src/components/` is flat today and already holds one page's parts under a prefix —
`ListSurface.vue`, `ListFooter.vue`, `ListBulkBar.vue`. At 13 files it is one page short of
AGENTS.md's fifteen, and the record page adds eighteen. The flat convention cannot survive this
page, so the same slice that creates `components/record/` also moves the list's three into
`components/list/`. `components/` is then only cross-page chrome: `AppShell`, `PageHeaderPortal`,
`PageBreadcrumbs`, `NotFoundPage`, `KeyboardShortcut`, and the settings and about dialogs.

Moving the list files is not tidying. Left in place, `components/` would mean two things at once
and no reader could derive which one a new file belongs to.

### The tree

```
src/pages/Record.vue                    the shell: header slot, isolate root, three tags
src/components/record/
  RecordHeader.vue                      breadcrumbs, assignees, Save — props only, never inject
  RecordAssignees.vue                   the stacked avatars and the assignment menu
  RecordTabs.vue                        the strip, the ?tab sync, <component :is="resolveTab()">
  RecordFeed.vue                        the scroller, both fades, the scroll button, the band
  RecordComposer.vue                    collapsed pill / comment / + ; expanded editor
  ComposerEmailFields.vue               To, Cc, Bcc
  RecordPanel.vue                       PanelEdge + the aside; owns usePanelState
  PanelEdge.vue                         w-resize, drag, collapse, reopen, the round chevron
  RecordIdentity.vue                    avatar, title, subtitle, tags, actions — never scrolls
  RecordActions.vue                     quick actions, row or rail, plus the overflow menu
  RecordTags.vue                        the tag row
  TagPicker.vue                         adding one
  ShareDialog.vue                       followers and shared-with
  tabs/
    ActivityTab.vue  EmailsTab.vue  FilesTab.vue  DetailsTab.vue  UnknownTab.vue
src/composables/
  useRecordPage.ts  useDocinfo.ts  usePanelState.ts  useScrollEdges.ts
src/data/
  resources.ts (recordResources)  tabTypes.ts  recordLayout.ts
```

Thirteen files and five, both under the limit. `tabs/` earns its directory because
`resolveTab`'s table is exactly that folder's contents — the directory is the extension point.
Nothing else in the tree is, so nothing else nests. Grouping into `record/panel/` and
`record/feed/` was rejected: it buys headroom nobody needs yet and charges a judgement call on
every new file that a flat list does not ask.

Three prototype files have no successor. `AvatarGroup.vue` and `PeopleControl.vue` collapse into
`RecordAssignees.vue` — frappe-ui's `Avatar` already stacks, and the two only split because one
was mock chrome. `dirtyState.ts` and `genericMock.ts` die with the prototype.
`useScrollEdges.ts` graduates to `src/composables/` unchanged.

### Who owns what, where it was not already settled

**`RecordFeed` owns the composer band, and each feed tab wraps it.** Activity, Emails and Files
each render `<RecordFeed>` and fill its slot. Details renders no `RecordFeed`, so it gets no
band without any component testing for one — there is no `isFeed` flag in the tree.
[The tab contract](004-tab-contract.md)'s flat prop list survives intact.

The cost is that a tab switch unmounts a half-typed reply, so **the composer draft is a
`useRestoredRef`**, the same mechanism 004 chose for scroll position and for the same reason: it
also survives leaving the record. Hanging the band above `<component :is>` in `RecordTabs` was
rejected — the scroll button would have to drive the active tab's scroller, which means the tab
handing an element upward through a channel 004 deliberately did not give it.

**`RecordPanel` is a two-root fragment — `<PanelEdge>` then `<aside>` — and calls
`usePanelState(doctype)` itself.** Nothing outside the panel reads `width`, `collapsed`,
`dragging` or `openSections`; `record-page.md:52` forbids a collapse control in the header, so
the header does not. [Where the panel's own state is kept](008-panel-state-persistence.md) said
`Record.vue` sees three refs; that was a suggestion about storage never reaching `PanelLayout`,
not a constraint about which component calls the composable, and the seam belongs with the width
it drags (`record-page.md:98`). `Record.vue`'s template is `<RecordHeader>`, `<RecordTabs>`,
`<RecordPanel>` inside one `isolate` container.

**`layout: Section[]` joins the `TabProps` superset.** 004 listed six props and none of them is
the schema `DetailsTab` renders. `recordResources` fetches it once and `Record.vue` binds it to
both `RecordPanel` and every tab; Details is the only reader, which is what a superset is for.
Letting `DetailsTab` reach into `data/fieldsLayout.ts` on its own was rejected as a private data
channel inside a page whose tabs otherwise cost zero fetches to switch.

Both surfaces call `resolveLayout(schema, doc)` **independently**, inside `FormLayout` and
`PanelLayout`. It bakes `depends_on` against a live doc and must re-run as the doc changes, so
there is no resolved tree to hoist.

### The header carries no status

`record-page.md:25` listed breadcrumb, assignees, status and Save, and the prototype renders a
status pill (`GenericHeader.vue:17-26`) — hardcoded and non-writing. **The pill is dropped.**

A generic `/:doctype/:id` cannot know which field is the status. `CRM Lead` has one, `Contact`
does not, and no convention names it. Guessing at `status` or the first Select puts a guess in
the chrome of every doctype's record page, and nominating a field is the layout work already out
of scope. Keeping it read-only fails differently: `record-page.md:25`'s point is that the header
carries _state_, and a state you cannot change is a label.

So the header reads `docinfo` and `isDirty` and writes nothing to the doc.
[Who owns the doc and its dirty state](002-doc-state-ownership.md)'s three surfaces stay three.
`record-page.md`'s layout diagram and its first decision are amended by this ticket.

`RecordHeader` is a component, not markup inlined in the portal slot the way `List.vue` and
`Detail.vue` do it, because the assignment menu mutates `docinfo` through its own endpoint. It
takes props and emits `save`; slot bindings close over `Record.vue`'s setup scope, so the
no-inject constraint 002 established is satisfied without provide/inject.

### The active tab is in the URL

**`?tab=<item.name>`, written with `router.replace`, owned by `RecordTabs`** as a computed with
a `route.query` getter and a `replace` setter.

`pageState()` keys its bags by history position and seeds a fresh entry from `lastByPath`, which
is keyed by pathname alone (`data/cache/pageState.ts`). A query-only navigation therefore keeps
every tab's scroll offset either way, so the choice is only about history. `replace` does not
move the position at all, and Back leaves the record — which is what Back means on a record page.
`push` would make four tab clicks into four history entries and turn the page into a trap
between the reader and the list.

The param carries `item.name`, not `item.type`. They are identical today, since `tabItem` sets
`name` to the type, so URLs read `?tab=emails`. But 004 lets several tabs share a kind, so `type`
stops being unique the moment tabs come from real `Navigation Item` records.

An absent or unrecognised value **falls back to the first tab and leaves the URL alone** — no
redirect on load, no rewriting a link someone typed wrong.

Per-tab scroll stays a `useRestoredRef` keyed `scroll:${item.name}`, so the page runs two
persistence mechanisms on purpose: the URL says which tab, page state says where in it. A URL
cannot carry a scroll offset without polluting every shared link.

### The traps

One is structural.

| Trap (`record-page.md:129`)                      | Verdict    | What it binds                                                                                                                                                                             |
| ------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog` overlay is `z-index: auto`              | **Seam**   | `isolate` on `Record.vue`'s root container. It is why the page has a root container rather than a fragment, and it must enclose both `RecordFeed`'s `z-10` band and `PanelEdge`'s `z-20`. |
| `Tooltip` drops `$attrs` in a `Dropdown` trigger | **Markup** | Two components: the composer's `+` (`GenericComposer.vue:38-46`) and `RecordActions`' `⋯`. Each needs a boxed wrapper taking the trigger props. Shape, not tree.                          |
| `bg-surface-white` is not generated              | Line       | Nothing.                                                                                                                                                                                  |
| `Dialog` focuses its close button                | Line       | `ShareDialog` and `TagPicker` internally.                                                                                                                                                 |

A fifth constraint belongs with them, already stated at `record-page.md:88` but not listed as a
trap: **section headers and their fields must be siblings, and the header height fixed at 42px.**
A sticky header cannot outlive its containing block, so `PanelLayout` may not wrap a section in a
`<section>` box, and the stacking offsets are only knowable without measurement if the height is
a constant. That binds `PanelLayout`'s internal structure in `@framework/ui`, which makes it the
one constraint in this ticket that lands outside this repo.

### The rename, and everything it drags

Confirmed against the tree — `Detail`, `detailResources` and `scrollTop` appear in four files
outside the prototype.

| Today                                   | After                              |
| --------------------------------------- | ---------------------------------- |
| `src/pages/Detail.vue`                  | `src/pages/Record.vue`             |
| `src/composables/useDetailPage.ts`      | `src/composables/useRecordPage.ts` |
| `detailResources()` (`resources.ts:30`) | `recordResources()`                |
| `resources.record`                      | `resources.docResource`            |
| route name `Detail` (`router.ts:31`)    | `Record`                           |

No call site breaks: nothing navigates by the route name, and `List.vue:209` pushes a path.

The rename drags one signature. `useScrollRestore` hardcodes the key `'scrollTop'`
(`usePageState.ts:28`) and 004 needs it per tab, so it takes a `name` parameter **defaulting to
`'scrollTop'`** — which leaves `List.vue` and both test files untouched.

`data/fieldsLayout.ts` does not move. The list's create dialog renders through it too
(`List.vue:103-108`), so it is shared, not the record page's.

### What the prototype's deletion is contingent on

**One deletion, in the last build slice**: the twenty files, the `/prototype/record/:doctype`
route in `router.ts`, and the empty `src/pages/prototype/` directory, in one commit.

The condition is checkable rather than a judgement — **the prototype dies when no ticket in the
build set still cites it.** The last slice's ticket carries the deletion, and a slice whose
ticket still holds a citation is by definition not the last one.

Until then it stays the only place the whole shape renders at once, and the build doc cites it by
file and line instead of reproducing its class strings. Deleting it when the build doc is written
would force the doc to carry every one of those strings, making it a source file in prose.
Deleting it piecewise would lose the side-by-side comparison, which is the one thing it is
uniquely for.

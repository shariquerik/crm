---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: claude
blocked_by: [005-component-seams.md]
status: closed
---

# The build slices, and what each one leaves working

## Question

[Component seams, names and file layout](005-component-seams.md) named every component. Cut them
into slices, in order, and say what the app does at the end of each one.

The record page is rewritten fresh, so there is no half-migrated state to protect — but there is
a shipped `Detail.vue` serving `/:doctype/:id` today, and every slice boundary is a point where
that route has to render something honest. Decide whether the rewrite lands behind the live route
from slice one, or beside it until it is whole.

Two slices are already pinned at the ends:

- **First is `PanelLayout`**, in `@framework/ui` on a frappe branch, per
  [Where the side panel's fields come from](003-side-panel-fields.md). It is the map's one
  out-of-repo dependency, so nothing in this app can be the true first slice.
- **Last carries the prototype's deletion**, per 005 — twenty files, the `/prototype/record/:doctype`
  route, and `src/pages/prototype/`, in one commit. The test is that no remaining ticket cites it.

Settle:

- The slices between those two, in order, each one a shippable commit.
- What `/:doctype/:id` renders at the end of each — today's form, a partial record page, or the
  finished one.
- Where the `components/list/` move lands. 005 put it in "the same slice" that creates
  `components/record/`; name that slice.
- Which slices depend on the frappe branch, and what this app does if that branch is late.
- What each slice's ticket needs to carry so the build set can be worked without this map.

Save is not a slice boundary of its own. [What a save actually costs](009-save-endpoint-cost.md)
and [What a save does when the record moved underneath it](010-save-conflict-recovery.md) settle
what `save()` calls and how it fails; this ticket only places that work in the order.

## Read first

Paths are relative to `frontend2/`.

- [../map.md](../map.md), then this ticket.
- [Component seams, names and file layout](005-component-seams.md), resolution included — the
  tree it names is what this ticket cuts up. Do not redraw it.
- The other four closed tickets' resolutions, for what each slice owes:
  [What backs Activity, Emails and Files](001-feed-data-sources.md),
  [Who owns the doc and its dirty state](002-doc-state-ownership.md),
  [Where the side panel's fields come from](003-side-panel-fields.md),
  [The tab contract](004-tab-contract.md),
  [Where the panel's own state is kept](008-panel-state-persistence.md).
- `AGENTS.md` — binding.
- `src/pages/Detail.vue` and `src/router.ts` — what is live today and must keep working.
- `git log --oneline -15` — the size and shape of a commit in this app.

## How to resolve

`/grilling`. Come with a proposed slice list; a blank page makes a bad interview.

## The answer must say

- The ordered slices, each with a one-line statement of what it leaves working.
- What `/:doctype/:id` serves at every boundary.
- Which slices need the frappe branch, and the fallback if it is late.
- The slice that moves `components/list/`.
- What a build ticket carries, so [Write the build doc and cut the build tickets](006-write-build-doc.md)
  is transcription rather than a second design pass.

## Resolution

### The rewrite lands behind the live route

`/:doctype/:id` serves the rewrite from slice 02 onward. There is no parallel route, no duplicate
resource wiring and no cutover commit.

Today's page is 63 lines rendering `FormLayout` and a Save button, so the rewrite reaches parity
with it on the way past rather than after eight slices of catching up. Building beside the live
route was rejected because its cutover is the one commit nobody can test incrementally, and
because it leaves the shipped page unexercised for the whole build.

The cost is that between slices 03 and 07 the page has tabs and no side panel. The Details tab
holds every field for that whole stretch, so what is missing is the dense summary, never the data.

### The slices

| #   | Slice                                                                                                                | `/:doctype/:id` at the end of it                                |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 01  | `PanelLayout` in `@framework/ui`                                                                                     | unchanged — today's form                                        |
| 02  | Rename, `getdoc`, `client.save` with the null-normalized diff, `useScrollRestore(name)`, the `components/list/` move | unchanged to look at; saving through the new endpoint           |
| 03  | `Record.vue`, `RecordHeader`, `RecordTabs`, `DetailsTab`, `tabTypes.ts`, `recordLayout.ts`, `?tab=`                  | the page shell, one tab — Details — holding today's form        |
| 04a | `useDocinfo`, the `docinfo_update` handler, the reconnect refetch, `RecordAssignees`                                 | header finished: assign someone, avatars update over the socket |
| 04b | `RecordFeed`, `useScrollEdges`, `ActivityTab`                                                                        | Activity is real, first in the strip, and opens by default      |
| 05  | `EmailsTab`, `FilesTab`, the `get_communications` pager, the `File` query, the `attachment_logs` fan-out             | four real tabs, read-only                                       |
| 06  | `RecordComposer`, `ComposerEmailFields`, the band, `add_comment` and `email.make`, the `+` menu                      | comment and reply; posts arrive by push                         |
| 07  | `RecordPanel`, `PanelEdge`, `usePanelState`, the `PanelLayout` rows, click-to-edit, the merge modal, `_link_titles`  | the panel holds every field, resizable and collapsible          |
| 08  | `RecordIdentity`, `RecordActions`, `RecordTags`, `TagPicker`, `ShareDialog`, the tag, follow and share mutations     | the whole designed shape                                        |
| 09  | The prototype's deletion                                                                                             | byte-identical to slice 08                                      |

Nine slices, ten tickets: 04 splits.

### Why the cuts fall where they do

**Slice 02 changes no markup, and that is its value.** It carries the three sharpest measured
traps on the map — `getdoc` returning on `frappe.response.docs` rather than `message`
([What backs Activity, Emails and Files](001-feed-data-sources.md)), `fieldDiff` marking thirty
null keys dirty on the first save ([What a save actually costs](009-save-endpoint-cost.md)), and
`client.save` raising `TimestampMismatchError`
([What a save does when the record moved underneath it](010-save-conflict-recovery.md)) — against
a page whose template is untouched. A save regression after that commit bisects to a commit that
touched no component.

**The `components/list/` move rides slice 02, one slice earlier than
[Component seams, names and file layout](005-component-seams.md) placed it.** 005 fixed the rule
— `components/` is only cross-page chrome once `components/record/` exists — and moving the three
files in the rename slice satisfies it strictly, while keeping slice 03's diff about the record
page instead of about renamed imports in `List.vue`.

**Conflict recovery splits across 02 and 07.** Slice 02 takes the refetch, the silent retry when
nothing collides, and a plain error toast when something does; slice 07 takes the merge modal.
Save is not a slice of its own, and the modal is the largest component in a slice defended for
having none — so it lands with the panel, the second surface writing the same doc and the same
`_link_titles` map. Between the two, a concurrent edit is a toast, which is what every other save
error is anyway. What this risks is a decision no shipped code implements for five slices.

**Slice 03 ships a tab strip of one.** It routes `resolveTab`, the `RECORD_TABS` literal, `?tab=`
on `replace` and per-tab scroll through a real tab, so slice 04b's Activity is genuinely a tab
arriving rather than the strip's first proof. A seam not routed through once is a seam only
written down. Merging 03 and 04 was rejected: that commit would carry the shell, the eleven-bucket
assembly, `RecordFeed` and the socket together, by a distance the largest in the plan.

**Slice 04 splits at the socket.** 04a finishes `RecordHeader` and proves the
mutate-then-echo round trip — the path every later mutation uses — against a row of avatars, which
is a small enough surface to say plainly whether the subscription works. 04b then adds the feed
scroller and the Activity assembly, which [The tab contract](004-tab-contract.md) called the only
genuinely new work on the page.

**Emails and Files share slice 05.** Each is a tab component and a query against a `RecordFeed`
that already exists; splitting them buys a boundary where nothing is learned.

**The composer precedes the panel.** After 04b and 05 the page shows three feeds you can read and
cannot write to — a conversation surface that does not converse, and the most visibly incomplete
state the page passes through. Fields are never missing, so the composer closes a real gap and the
panel a cosmetic one. This defers integration risk on the framework branch by two slices, which is
the price.

**The panel splits into frame and chrome.** The panel exists to hold every field, so the slice
that makes it appear is the slice that puts fields in it; identity, actions and tags decorate a
panel already doing its job. Slice 08 is the least coherent in the plan — five components held
together by "in the panel, not a field" — and is the first candidate if a slice wants splitting
during the build.

### Three rules the order obeys

**A `docinfo` mutation ships with the control that fires it**, and a tab's query ships with its
tab. Assign in 04a, tag and follow and share in 08; the `get_communications` pager and the `File`
query in 05, not in slice 02's `recordResources`. Nothing is fetched or wired before something
reads it.

**No visible stub, at any boundary.** [The tab contract](004-tab-contract.md) rejected stub tabs;
the same test rejects an empty composer band and a half-drawn panel. So `RECORD_TABS` grows one
entry per slice, and `RecordFeed` ships in 04b without the band — the band arrives in 06 with the
composer inside it.

**Every file in 005's tree appears in exactly one ticket.** That is the coverage proof: the slices
cover the page and do not overlap, checkable by reading the tickets rather than by judgement.

### The frappe branch

`AGENTS.md:49-51` already makes this app unbuildable without a frappe branch — `Navigation`,
`SavedViews` and `IconPicker` are not on develop. `PanelLayout` is one more component on a branch
this app cannot run without today, not a new cross-repo dependency.

Slice 01 is the branch work and slices 07 and 08 consume it. Nothing else touches it, so 02
through 06 build against the branch as it stands.

**If it is late, the build stops at 06 and waits.** The page at 06 is a header, four real tabs and
a working composer, with every field under Details — shippable, not broken. **No app-local panel
renderer, not even temporarily**: [Where the side panel's fields come from](003-side-panel-fields.md)
rejected duplication on the merits, and a temporary copy in `components/record/` is the version
that survives.

Slice 01's ticket lives in this repo's build set but its work lands in `apps/frappe/ui`, so it
carries that repo's two hazards: no test runner of its own, and `npx prettier` there reformatting
untouched lines.

### What a build ticket carries

Seven fields, fixed shape, so
[Write the build doc and cut the build tickets](006-write-build-doc.md) is transcription:

1. Slice number and name, and its one-line statement of what it leaves working.
2. What `/:doctype/:id` renders when it lands — the acceptance test, written as what you see.
3. Files created, moved and deleted, by exact path from 005's tree. No file in two tickets.
4. The decisions it implements, as links to the closed tickets **by name**. The build doc gists,
   the ticket points, neither restates.
5. Prototype citations — file and line for the markup and class strings to lift.
6. The `@framework/ui` surface it consumes: `resolveLayout`, `useFieldTypes().resolve`,
   `formatField`, `FormLayout`, `PanelLayout`.
7. The traps binding that slice, and only those: `isolate` on the root in 03, the boxed
   `Tooltip`-in-`Dropdown` wrapper in 06 and 08, `getdoc` landing on `docs` in 02, null against
   missing in 02, `socket.off` with the handler reference in 04a.

The tickets live in **`docs/record-page-build/`**, sibling to `docs/record-page-build.md`, named
`01-panel-layout.md` through `10-delete-prototype.md`. They carry no wayfinder label and no
`parent:` — they are execution, not decisions, and a closed map must not hold ten open children.

### The prototype dies alone

Slice 09 is one commit of pure deletion: the twenty files, the `/prototype/record/:doctype` route
(`router.ts:12-18`), and the `src/pages/prototype/` directory.

005 made this checkable — the prototype dies when no ticket in the build set still cites it — and
field 5 above means every building ticket cites it, slice 08 most of all. A deletion-only ticket
cites nothing, so it passes the test by construction. Hanging the deletion off slice 08 would
break 005's own rule.

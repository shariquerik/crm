# Record page — build plan

How `/:doctype/:id` gets built. [record-page.md](record-page.md) says what the page is; this
document says what it is made of, who owns which piece of state, and the order the pieces land in.
Vocabulary is in [CONTEXT.md](../CONTEXT.md); storage is in
[ADR 0001](adr/0001-customization-storage-lives-in-the-framework.md).

The page is rewritten fresh. `Detail.vue` is renamed, not extended, and nothing is migrated in
place — so there is no half-built state to protect, only a live route that has to render something
honest at every commit.

The prototype at `src/pages/prototypes/generic/` renders the whole shape against a mocked Contact.
It is **reference, not source**: the build tickets cite it by file and line for markup and class
strings, and it is deleted in one commit once no ticket still cites it.

## Prerequisite

**Mentions must move onto the framework before the composer can post.** `notify_mentions` runs from
a CRM `Comment` `on_update` doc_event, so it fires on every comment whatever endpoint the composer
calls, and it reads `reference_doc.organization` — which raises on a Contact or any other doctype
that is not a Lead or Deal. The fix is to delete CRM's copy, because
`Comment.after_insert` already notifies mentions generically for every doctype, and to make CRM's
bell union `Notification Log` with `CRM Notification` so nothing drops out of the old frontend.

It is backend Python plus the old `frontend/`, it depends on no seam below, and it is not a slice.
It is [Move mention notifications onto the framework](wayfinder/tickets/013-mention-notifications-to-framework.md),
landing before slice 07.

## The tree

**Shared by two or more pages → `src/components/`. Owned by one page → `src/components/<page>/`.**
`components/` is then only cross-page chrome — `AppShell`, `PageHeaderPortal`, `PageBreadcrumbs`,
`NotFoundPage`, `KeyboardShortcut`, and the settings and about dialogs. The record page adds
nineteen files, so the flat convention cannot survive it, and the list's three move under the same
rule rather than as tidying: left in place, `components/` would mean two things at once and no
reader could derive which one a new file belongs to.

```
src/pages/Record.vue                    the shell: header slot, isolate root, three tags
src/components/record/
  RecordHeader.vue                      breadcrumbs, assignees, Save — props only, never inject
  RecordAssignees.vue                   the stacked avatars and the assignment menu
  RecordTabs.vue                        the strip, the ?tab sync, <component :is="resolveTab()">
  RecordFeed.vue                        the scroller, both fades, the scroll button, the band
  RecordComposer.vue                    collapsed pill / comment / + ; the framework's composers
  RecordPanel.vue                       PanelEdge + the aside; owns usePanelState
  PanelEdge.vue                         w-resize, drag, collapse, reopen, the round chevron
  RecordIdentity.vue                    avatar, title, subtitle, tags, actions — never scrolls
  RecordActions.vue                     quick actions, row or rail, plus the overflow menu
  RecordTags.vue                        the tag row
  TagPicker.vue                         adding one
  ShareDialog.vue                       followers and shared-with
  SaveConflictDialog.vue                the three-way merge, per field
  tabs/
    ActivityTab.vue  EmailsTab.vue  FilesTab.vue  DetailsTab.vue  UnknownTab.vue
src/components/list/
  ListSurface.vue  ListFooter.vue  ListBulkBar.vue
src/composables/
  useRecordPage.ts  useDocinfo.ts  usePanelState.ts  useScrollEdges.ts
src/data/
  resources.ts (recordResources)  tabTypes.ts  recordLayout.ts  composer.ts  users.ts
```

Thirteen files and five, both inside AGENTS.md's fifteen. **`tabs/` earns its directory because
`resolveTab`'s table is exactly that folder's contents** — the directory is the extension point.
Nothing else in the tree is, so nothing else nests; grouping into `record/panel/` and `record/feed/`
would buy headroom nobody needs and charge a judgement call on every new file.

Three prototype files have no successor. `AvatarGroup.vue` and `PeopleControl.vue` collapse into
`RecordAssignees.vue`, since frappe-ui's `Avatar` already stacks and the two only split because one
was mock chrome. `dirtyState.ts` and `genericMock.ts` die with the prototype. `ComposerEmailFields.vue`
and `ComposerField.vue` join them: `@framework/ui`'s `EmailComposer` ships the same To/Cc/Bcc rows,
including the switch that clears a row on the way out. `useScrollEdges.ts`
graduates to `src/composables/` unchanged.

**The rename drags five names and one signature.**

| Today                                   | After                              |
| --------------------------------------- | ---------------------------------- |
| `src/pages/Detail.vue`                  | `src/pages/Record.vue`             |
| `src/composables/useDetailPage.ts`      | `src/composables/useRecordPage.ts` |
| `detailResources()` (`resources.ts:30`) | `recordResources()`                |
| `resources.record`                      | `resources.docResource`            |
| route name `Detail` (`router.ts:31`)    | `Record`                           |

`useScrollRestore` hardcodes the key `'scrollTop'` (`usePageState.ts:28`) and the page needs one per
tab, so it takes a `name` parameter defaulting to `'scrollTop'` — which leaves `List.vue` and both
test files untouched. `data/fieldsLayout.ts` does not move: the list's create dialog renders through
it too, so it is shared, not the record page's. No call site breaks, because nothing navigates by
the route name.

## Who owns what

**`useRecordPage(resources)` owns the doc**, one composable called once in `Record.vue`, matching
the `useListPage(resources)` convention. It returns `doc`, `isDirty`, `changedFields()`, `save()`
with `saving` and `saveError`, `breadcrumbs`, the `_link_titles` map, and the spread of
`useDocinfo(docResource)`.

No component calls an `update(fieldname, value)`. `FormLayout` and `PanelLayout` each take
`v-model:doc` and provide `DocKey` / `UpdateKey` to their own fields, so field writes land on the
shared ref through the surface component. The owner exposes the doc, not a setter.

**Three surfaces reach it three ways, and the reason is structural rather than preference.**
`PageHeaderPortal` is not a Teleport — it stashes the slot function in a module-scope ref and the
app shell renders it, so a component inside that slot calling `inject()` would resolve against the
shell's tree. Provide/inject therefore cannot serve the header at all, and anything the header needs
sits in `Record.vue`'s setup scope, reached by slot closure. The panel and the Details tab take
`v-model:doc`. `docinfo` consumers take props from `Record.vue`.

**Dirtiness is a self-healing diff.** `isDirty` derives from `fieldDiff(doc.value,
docResource.data)`, so there is one source for "what changed" and no flag to forget to clear: edit a
value and edit it back, and `Save` disappears again. The cost is a JSON comparison per edit.
**The owner holds no read-only rule at all** — `resolveLayout` bakes `readOnly` onto every field
node and the surfaces refuse to open a control for such a field, so a read-only field is never
written and never enters the diff. That ignorance is the point: the owner stays a doc owner, not a
layout consumer.

**`docinfo` lives in `useDocinfo(docResource)`**, a sub-composable `useRecordPage` composes and
spreads, the same shape as `useListPage` composing `useViewState` and `useCreateDoc`. It reads its
eleven buckets off the shared `getdoc` response rather than fetching, and owns the `docinfo_update`
subscription and the assign, tag, like and follow mutations. **`docinfo` never touches `isDirty` or
`save`** — it is not part of the document being edited, so it does not belong in the diff, and
keeping it out leaves eleven buckets, a socket and four endpoints outside the owner.

**`usePanelState(doctype)` owns the panel's own state**, and `RecordPanel` calls it. Nothing outside
the panel reads `width`, `collapsed`, `dragging` or `openSections`, and `record-page.md:52` forbids
a collapse control in the header, so the state belongs with the seam that drags it. All of it is
`localStorage`, none of it is customization — see `record-page.md:101` for the scoping and the
divergence-only format. **`PanelLayout` never sees a width** and is fully controlled for open
sections through `v-model:openSections`, so the app's storage format never crosses into
`@framework/ui`.

**The active tab is `?tab=<item.name>`, written with `router.replace`, owned by `RecordTabs`** as a
computed with a `route.query` getter and a `replace` setter. `pageState()` keeps every tab's scroll
offset either way, so the choice is only about history: `replace` does not move the position, and
Back leaves the record, which is what Back means on a record page. `push` would make four tab clicks
into four history entries and trap the reader between the record and the list. The param carries
`item.name` rather than `item.type`, because several tabs can share a kind the moment tabs come from
real `Navigation Item` records. An absent or unrecognised value falls back to the first tab and
leaves the URL alone.

**Per-tab scroll stays a `useRestoredRef` keyed `scroll:${item.name}`**, so the page runs two
persistence mechanisms on purpose: the URL says which tab, page state says where in it. A URL cannot
carry a scroll offset without polluting every shared link. The composer's draft is a `useRestoredRef`
too, for the same reason — `RecordFeed` owns the composer band and each feed tab wraps it, so a tab
switch unmounts a half-typed reply.

## Tabs

**Every tab component declares the same superset of props and ignores what it does not use.**

```ts
type TabProps = {
  /** The tab's own stored config — one component can back several tabs. */
  item: NavigationItem
  /** `v-model:doc`. Only the Details tab writes; the feeds ignore it. */
  doc: Record<string, any>
  doctype: string
  docname: string
  /** The eleven `getdoc` buckets, from `useDocinfo`. */
  docinfo: Docinfo
  /** The Emails pager and the Files list query. */
  feeds: Feeds
  /** The resolved `Section[]`. Details is the only reader. */
  layout: Section[]
}

// emits: 'update:doc'
```

A superset over a context bag, because it keeps each tab a plain component a test can mount with
literals. **`item` is the pressure valve the superset needs**: passing a tab its own
`Navigation Item` means one component can back several tabs, and a new knob on a tab kind becomes a
`Navigation Item` field rather than a new prop every tab re-declares. The id prop is `docname`, not
`name`, which would collide with `item.name`.

**`type` resolves through a frozen literal behind one function**, in `src/data/tabTypes.ts`:

```ts
export function resolveTab(type: string): Component {
  return TABS[type]?.component ?? UnknownTab
}
```

No `register()`, no `Map`, no fallback keyed by a magic string — the static version does not pretend
to be a registry. `resolveTab`'s **body** is the single seam: when `registerRecordComponent` ships
on the frappe side, that body becomes a call into the framework registry and no consumer changes.
`@framework/ui` already runs this pattern one layer down for fieldtypes, so the registry this grows
into has a working precedent. A registered extension supplies a `TabKind`, not a bare component, so
it brings its create action with it — and the composer's `+` menu reads the same table, which is
what stops "which tabs exist" and "what `+` offers" drifting apart. On day one that menu holds
exactly one entry, _Attach a file_.

**One tab is mounted at a time**, destroyed on switch — plain `<component :is>`, no `<KeepAlive>`.
Lazy mounting saves nothing, since one `getdoc` serves all three feeds and a tab switch costs zero
fetches. A half-edited Details form survives the unmount for free, because `doc` lives above the
tab; a feed's scroll position is restored from page state, which beats `KeepAlive` rather than
matching it, since position also survives leaving the record. `KeepAlive` would solve the smaller
half of the problem and leave every visited tab's watchers running behind the one on screen.

**Four tabs on day one, all real, in this order: Activity, Emails, Files, Details.** No stubs — a
stubbed tab is a visibly empty tab in a shipped product, worse than not listing it. The first tab
opens, so no default is stored anywhere, and `Details` stays last: the panel already holds every
field, so Details is the overflow surface, not the primary one. Opening on Activity says the record
page is a conversation surface first.

`recordLayout.ts` holds `RECORD_TABS` as a `NavigationItem[]` built by a `tabItem(type, label,
icon)` helper, so the literal satisfies the real ten-field type without ten lines of noise per
entry. The later swap to stored tabs is then one line — `useNavigation(doctype, undefined, { app:
APP_NAME, surface: 'record' })` — waiting only on `surface` joining `NavigationScope`.

## Data

**All three feeds come from one call**, `frappe.desk.form.load.getdoc`, which the page has to make
anyway for assignment, tags, share and follow. So `recordResources` keeps the shape of
`detailResources` and swaps `frappe.client.get` for `getdoc`, which unlocks `docinfo` and every feed
at once.

- **Activity** is not an endpoint. It is eleven `docinfo` keys assembled client-side — comments,
  versions, communications, views, shares, likes, workflow, the assignment, attachment and info
  logs, milestones, plus synthetic created and edited entries. Desk does this at
  `form_timeline.js:162`. Zero extra fetches.
- **Emails** are `docinfo.communications`, and the only feed that pages: `docinfo` carries
  `limit=21`, and more arrives through `frappe.desk.form.load.get_communications(doctype, name,
start, limit)`, offset-style.
- **Files** needs one `File` list query of its own. `docinfo.attachments` is unlimited and free but
  its field list carries no `creation`, `modified` or `owner`, and Files renders as a feed with
  timestamps.

`crm.api.activities.get_activities` — what today's `frontend/` calls — is Lead- and Deal-only and
raises otherwise, so it cannot back a generic record page. Its shape is not worth copying either: it
re-queries attachments per comment and per communication.

**Freshness is push-based, and `docinfo_update` is the single writer into `docinfo`.** A post you
made and a post a colleague made travel the identical path; the send call's response never enters
the feed. This is not a preference — `add_comment` returns the Comment doc, but `email.make` returns
only `{name, emails_not_sent_to}`, so an email rendered from its response would be a stub needing a
`Communication` fetch that duplicates the delta already in flight. Response-writing means one path
for comments and a second for emails. Push-only therefore needs **no reconciliation at all**: no
de-dupe by name, no pending row in the renderer, no rollback on failure.

The handler splices by `action` after filtering on `doc.reference_doctype` and `doc.reference_name`
— `add` pushes, `update` splices in place at the index found by `name`, `delete` splices out;
`frappe/public/js/frappe/form/form.js:2306` is the reference implementation. Today's CRM handler
refetches everything on any `comments` event; do not copy that. **One bucket fans out**: attaching a
file posts a Comment with `comment_type: Attachment`, so the echo lands on `attachment_logs` and the
handler reloads the Files query as well as splicing. The subscription is page level, owned by
`useDocinfo`, torn down with `doc_unsubscribe` and a `socket.off` that passes the handler reference.
Push-only makes the socket load-bearing, so **`useDocinfo` refetches `docinfo` on reconnect** — one
`getdoc` repairs every delta missed while offline.

**The composer sends by `crm.api.comment.add_comment` and
`frappe.core.doctype.communication.email.make`.** `add_comment` is already generic over
`reference_doctype` and does the File-to-Comment linking the attach control needs; the framework's
`frappe.desk.form.utils.add_comment` has no attachment handling. Neither response is rendered — it
is awaited only for errors and for `emails_not_sent_to`, which becomes a warning toast. Submit
disables the editor and swaps the button label for a spinner, and **the composer stays open until
the call resolves**, then collapses and clears. The feed shows nothing in the gap. A failure leaves
the composer open with the content intact plus an error toast; the draft is never held anywhere but
the open composer, which is what makes this cheaper than collapsing immediately.

## Saving

**`save()` calls `frappe.client.save({ doc })`.** Measured against `CRM Deal` with the recorder: 24
SQL statements and 19.3 ms, against 45 and 175 kB returned for today's `set_value` plus reload, and
33 for desk's `savedocs`. It is the same whole-document write with the same conflict detection as
`savedocs`, without `get_docinfo`, `run_onload`, `capture_doc`, the `"Saved"` msgprint or the
`docstatus` action map — none of which this page wants, since it does not create records on this
path and gets `docinfo` by realtime. Full findings in
[record-save-cost.md](research/record-save-cost.md).

Four things follow, three of them measured rather than reasoned:

- **Send the whole document, never a subset.** Dropping `products` deleted all 200 rows; dropping a
  field nulled it. `changedFields()` is the dirty check and the conflict replay, not the payload.
- **Normalize null against missing before diffing.** `getdoc` omits nulls via
  `as_dict(no_nulls=True)`; every save endpoint returns them. Left alone, `fieldDiff` compares
  `JSON.stringify` and marks thirty fields dirty after every save.
- **Repaint from the response, not a reload.** `client.save` returns the document as `message`, and
  that response is the new dirty-check baseline.
- **`_link_titles` is a page-owned map**, seeded from `getdoc` and written on every Link pick. No
  save endpoint returns titles, so the endpoint choice does not bend for this. Nothing reads the map
  today — `Link.vue` resolves its display label from the `search_link` options resource — so it is
  needed only for the panel's read state. A key missing for any other reason renders the raw name:
  ugly, never a lie.

**A concurrent edit recovers by three-way merge, not by reloading.** The page already holds two of
the three versions — the fetched baseline and the user's edits — so on HTTP 409 with
`exc_type: "TimestampMismatchError"`, and on nothing else, one `getdoc` brings the third along with
fresh `_link_titles` and the `docinfo.user_info` that names the other person for free. Diff twice
against the baseline; the collision set is the intersection.

- **Empty collision set — reapply and retry once**, toasting _"Saved. Jane Doe also edited this
  record while you were working."_ A second 409 falls through to the dialog rather than retrying.
  This is the common case, since a panel click-to-edit save is one field. Retrying does not break
  "saving is explicit": the user pressed Save, and one retry completes the action they asked for.
- **Non-empty — reapply what does not collide, then open `SaveConflictDialog`** with the user's
  values showing in the colliding fields. A modal, because the decision blocks the save and because
  the colliding field may sit in a collapsed panel section while Activity is open — inline marking
  has no single place to stand when two collisions cross two surfaces. **It never says "refresh"**,
  because the page has already refetched, and it names the person rather than the record: this is a
  human problem whose real fix is usually to go ask Jane. **The default is theirs, per field**, so
  an accidental `Save` never destroys a write the user never saw. `Discard my changes` drops the
  diff; Escape closes on the merged, still-dirty state, because "go look at what Jane did" is the
  sane response and the next `Save` reopens the dialog anyway. **A colliding child table is one row,
  picked whole** — `client.save` replaces the whole table, so whole-table is the grain the payload
  has.

**Every other save error is a toast.** The inline `ErrorMessage` above the form is dropped rather
than moved: it sits inside one of four tabs, so it renders where nobody is looking as often as not.
`saveError` survives as composable state with no renderer. **Neither editing surface marks itself
after a failure** — the record staying dirty with `Save` lit is already a persistent marker, and a
`saveFailedFields` set would be state to invalidate in three places and would spend exactly what the
self-healing diff bought.

Two costs are accepted rather than solved, both observable only under a real concurrent edit: after
a silent retry the user's write lands on a record whose other fields moved without them seeing
either value, and a child-table collision is judged on row counts alone.

## What the framework supplies

One layout resolver feeds both editing surfaces, and each gets its own UI layer over it. **The
Details tab is `FormLayout` unchanged; the panel is `PanelLayout`, a new sibling in
`@framework/ui`** — label left, field right, in a `130px / 1fr` grid. Both call
`resolveLayout(schema, doc)` **independently**, inside the surface component: it bakes `depends_on`
against a live doc and must re-run as the doc changes, so there is no resolved tree to hoist.

`PanelLayout` writes no logic of its own. `resolveLayout` bakes the conditions,
`useFieldTypes().resolve` returns a fieldtype's control, `formatField` renders its display value,
and every control takes `{ field, modelValue }` and emits `update:modelValue`. All four are already
public exports of `@framework/ui/FormLayout`. **A dense single-column mode on `FormLayout` is dead,
not deferred** — the two are permanently different surfaces over one resolver, so it has no
consumer.

The panel's fields are **click-to-edit values, not live controls**. A section is
`section.columns.flatMap((c) => c.fields)` filtered on `hidden`, so the panel is always one column
and `FormLayoutSection`'s `sm:flex-row` never applies. Clicking a row mounts the resolved control
into that one cell with `{ ...field, label: undefined }`, so the control does not render its own
label into the grid. Fieldtypes with no honest 130px row — `Table`, `Text Editor`, `Code`,
`Geolocation`, `Image`, `Attach` — keep the row shape but show a one-line summary with a trailing
`↗` that switches to Details and scrolls to the field, so the panel stays uniform and "the panel
holds every field" stays true.

**The composer is `CommentComposer` and `EmailComposer` from `@framework/ui/components/Composer`**,
one card over a shared editing core. They arrived after this plan was written and cover the whole
expanded shape — the envelope rows, @-mentions, attachment upload, Discard and Submit — so
`RecordComposer` owns only the collapsed band, the mode, the draft and the two send calls. They
expose no in-flight state, so the card takes a spinner overlay instead of a submit button that
becomes one.

Everything else ADR 0001 needs from frappe — the Form Layout doctype, `surface` on
`NavigationScope`, `registerRecordComponent` — is outside this plan. Slice 01 is the only branch
work here, and slices 08 and 09 consume it.

## The traps

One of `record-page.md:130`'s four constrains a seam; the rest constrain a line.

| Trap                                             | Verdict    | What it binds                                                                                                                                                                  |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Dialog` overlay is `z-index: auto`              | **Seam**   | `isolate` on `Record.vue`'s root container, which must enclose both `RecordFeed`'s `z-10` band and `PanelEdge`'s `z-20`.                                                       |
| `Tooltip` drops `$attrs` in a `Dropdown` trigger | **Markup** | The composer's `+` and `RecordActions`' `⋯`. Each needs a boxed wrapper taking the trigger props — a `display: contents` wrapper measures as zero and anchors the menu at 0,0. |
| `bg-surface-white` is not generated              | Line       | Use `bg-surface-base`.                                                                                                                                                         |
| `Dialog` focuses its close button                | Line       | `ShareDialog` and `TagPicker`, internally, by marking a field `autofocus`.                                                                                                     |

A fifth belongs with them. **Section headers and their fields must be siblings, and the header
height fixed at 42px**: a sticky header cannot outlive its containing block, so `PanelLayout` may
not wrap a section in a `<section>` box, and the stacking offsets are only knowable without
measurement if the height is a constant. It is the one constraint here that binds code outside this
repo.

Two more bind a single slice each and are named on its ticket: `getdoc` returns its payload on
`frappe.response.docs`, not `message`, so calling `get_docinfo` alone through frappe-ui returns
`undefined`; and `socket.off` must be passed the handler reference, since a bare
`off('docinfo_update')` would kill other listeners.

## The slices

**The rewrite lands behind the live route from slice 02.** No parallel route, no duplicate resource
wiring, no cutover commit. Today's page is 63 lines rendering `FormLayout` and a Save button, so the
rewrite reaches parity with it on the way past rather than after eight slices of catching up.
Building beside the live route was rejected because its cutover is the one commit nobody can test
incrementally, and because it leaves the shipped page unexercised for the whole build.

The cost is that between slices 03 and 08 the page has tabs and no side panel. The Details tab holds
every field for that whole stretch, so what is missing is the dense summary, never the data.

| #                                               | Slice                            | `/:doctype/:id` at the end of it                                |
| ----------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| [01](record-page-build/01-panel-layout.md)      | `PanelLayout` in `@framework/ui` | unchanged — today's form                                        |
| [02](record-page-build/02-rename-data-layer.md) | Rename and the data layer        | unchanged to look at; saving through the new endpoint           |
| [03](record-page-build/03-record-shell.md)      | The shell and a one-tab strip    | the page shell, one tab — Details — holding today's form        |
| [04](record-page-build/04-docinfo-assignees.md) | `useDocinfo` and the header      | header finished: assign someone, avatars update over the socket |
| [05](record-page-build/05-activity-feed.md)     | `RecordFeed` and Activity        | Activity is real, first in the strip, and opens by default      |
| [06](record-page-build/06-emails-files.md)      | Emails and Files                 | four real tabs, read-only                                       |
| [07](record-page-build/07-composer.md)          | The composer                     | comment and reply; posts arrive by push                         |
| [08](record-page-build/08-panel-frame.md)       | The panel frame                  | the panel holds every field, resizable and collapsible          |
| [09](record-page-build/09-panel-chrome.md)      | The panel's chrome               | the whole designed shape                                        |
| [10](record-page-build/10-delete-prototype.md)  | The prototype's deletion         | byte-identical to slice 09                                      |

Ten slices, one ticket each. Slices 04 and 05 are the two halves of what
[The build slices](wayfinder/tickets/011-slice-order.md) numbered 04a and 04b.

**Slice 02 changes no markup, and that is its value.** It carries the three sharpest measured traps
on the plan — `getdoc` returning on `docs`, `fieldDiff` marking thirty null keys dirty on the first
save, and `client.save` raising `TimestampMismatchError` — against a page whose template is
untouched. A save regression after that commit bisects to a commit that touched no component. The
`components/list/` move rides here rather than with `components/record/`, which keeps slice 03's
diff about the record page instead of about renamed imports in `List.vue`.

**Conflict recovery splits across 02 and 08.** Slice 02 takes the refetch, the silent retry when
nothing collides, and a plain error toast when something does; slice 08 takes the merge dialog. Save
is not a slice of its own, and the dialog is the largest component in a slice defended for having
none — so it lands with the panel, the second surface writing the same doc and the same
`_link_titles` map. Between the two, a concurrent edit is a toast, which is what every other save
error is anyway. The risk is a decision no shipped code implements for six slices.

**Slice 03 ships a tab strip of one.** It routes `resolveTab`, the `RECORD_TABS` literal, `?tab=` on
`replace` and per-tab scroll through a real tab, so slice 05's Activity is genuinely a tab arriving
rather than the strip's first proof. A seam not routed through once is a seam only written down.
Merging 03 with 04 and 05 was rejected: that commit would carry the shell, the eleven-bucket
assembly, `RecordFeed` and the socket together.

**Slice 04 stops at the socket.** It finishes `RecordHeader` and proves the mutate-then-echo round
trip — the path every later mutation uses — against a row of avatars, which is a small enough
surface to say plainly whether the subscription works. Slice 05 then adds the feed scroller and the
Activity assembly, the only genuinely new work on the page.

**Emails and Files share slice 06.** Each is a tab component and a query against a `RecordFeed` that
already exists; splitting them buys a boundary where nothing is learned.

**The composer precedes the panel.** After 05 and 06 the page shows three feeds you can read and
cannot write to — a conversation surface that does not converse, and the most visibly incomplete
state the page passes through. Fields are never missing, so the composer closes a real gap and the
panel a cosmetic one. This defers integration risk on the framework branch by two slices, which is
the price.

**The panel splits into frame and chrome.** The panel exists to hold every field, so the slice that
makes it appear is the slice that puts fields in it; identity, actions and tags decorate a panel
already doing its job. Slice 09 is the least coherent here — five components held together by "in
the panel, not a field" — and is the first candidate if a slice wants splitting during the build.

**Slice 10 is one commit of pure deletion**: the twenty prototype files, the
`/prototype/record/:doctype` route, and the `src/pages/prototypes/` directory. The prototype dies
when no ticket still cites it, and every building ticket cites it, so a deletion-only ticket passes
that test by construction. Hanging the deletion off slice 09 would break the rule.

### Three rules the order obeys

**A `docinfo` mutation ships with the control that fires it**, and a tab's query ships with its tab.
Assign in 04; tag, follow and share in 09; the `get_communications` pager and the `File` query in
06, not in slice 02's `recordResources`. Nothing is fetched or wired before something reads it.

**No visible stub, at any boundary.** The same test that rejected stub tabs rejects an empty
composer band and a half-drawn panel, so `RECORD_TABS` grows one entry per slice and `RecordFeed`
ships in 05 without the band — the band arrives in 07 with the composer inside it.

**Every file in the tree appears in exactly one ticket.** That is the coverage proof: the slices
cover the page and do not overlap, checkable by reading the tickets rather than by judgement.

### The frappe branch

`AGENTS.md:49-51` already makes this app unbuildable without a frappe branch — `Navigation`,
`SavedViews` and `IconPicker` are not on develop. `PanelLayout` is one more component on a branch
this app cannot run without today, not a new cross-repo dependency. Slice 01 is the branch work and
slices 08 and 09 consume it; 02 through 07 build against the branch as it stands.

**If it is late, the build stops at 07 and waits.** The page at 07 is a header, four real tabs and a
working composer, with every field under Details — shippable, not broken. **No app-local panel
renderer, not even temporarily**, because a temporary copy in `components/record/` is the version
that survives.

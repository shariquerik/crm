---
labels: [wayfinder:map]
status: closed
---

# Record page build plan

## Destination

`docs/record-page-build.md` — the component seams for `/:doctype/:id`, what owns which
state, and the slices in build order — plus implementation tickets cut from those slices.
The record page is then **rewritten fresh** against those seams. No code ships from this map.

## Notes

Vue 3 + TypeScript, `frontend2` only. Read [AGENTS.md](../../AGENTS.md) before any change here.

The shape is already settled — do not relitigate it. [record-page.md](../record-page.md) holds
the layout and its decisions, [CONTEXT.md](../../CONTEXT.md) the vocabulary, and
[ADR 0001](../adr/0001-customization-storage-lives-in-the-framework.md) where customization is
stored. This map answers _how to build_ that shape, not _what_ it is.

`src/pages/prototypes/generic/` renders the whole shape against a mocked Contact. It is
**reference, not source**: read it, cite it, move nothing out of it. It dies with its route in
the last slice.

Every ticket is planning. Decide, record, stop — the pull to start writing the page is the
signal the map is done.

Skills: `/grilling` and `/domain-modeling` by default, `/research` for research tickets,
`/technical-writing` for anything written into `docs/`.

## Working a ticket

Each ticket is one session. That session should need nothing but this map and its ticket.

1. **Claim it.** Set `assignee` in the ticket's frontmatter before any work, so a parallel
   session skips it.
2. **Orient.** Read this map, then the ticket's own **Read first** list. Read the resolutions of
   the tickets that blocked it — those are linked from Decisions so far.
3. **Resolve it.** Follow the ticket's **How to resolve**. Every ticket here is HITL except the
   research ones: ask the human one question at a time and wait. Never answer on their behalf.
4. **Record it.** Append a `## Resolution` section to the ticket, set `status: closed`, and add
   one line to **Decisions so far** below — a gist and a link, never the detail. The detail
   lives in the ticket, in exactly one place.
5. **Clear the fog.** If the answer makes something in **Not yet specified** sharp enough to
   phrase as a question, cut it a ticket and delete the patch. If it puts a ticket beyond the
   destination, close that ticket and move one line to **Out of scope**.

Stop after one ticket. Do not start the next one, and do not start writing the record page —
that pull is the signal the map is working.

## Decisions so far

<!-- one line per closed ticket -->

- [What backs Activity, Emails and Files](tickets/001-feed-data-sources.md) — all three ride on
  one `getdoc` call the page must make anyway; Activity is `docinfo` assembled client-side,
  Emails page through `get_communications`, Files needs one `File` query for its timestamps.
- [Where the side panel's fields come from](tickets/003-side-panel-fields.md) — two of the three
  mismatches are real and the chevron one is false; the panel is a new `PanelLayout` sibling of
  `FormLayout` in `@framework/ui` over the same composables, rendering click-to-edit values in a
  `130px / 1fr` grid. Dense `FormLayout` is dead, and building `PanelLayout` is build slice one.
- [Who owns the doc and its dirty state](tickets/002-doc-state-ownership.md) — a `useRecordPage`
  composable owns the doc, reaching the header by slot closure and the two editing surfaces by
  `v-model:doc`; dirtiness stays a self-healing diff; `docinfo` gets its own `useDocinfo`
  sub-composable. `Detail.vue` and `useDetailPage` are replaced by `Record.vue` and
  `useRecordPage`. What `save()` calls was left open, and is settled below.
- [The tab contract](tickets/004-tab-contract.md) — every tab takes the same superset props plus
  its own `NavigationItem`; `type` resolves through a frozen literal behind one `resolveTab()`,
  the seam `registerRecordComponent` replaces later. One tab mounted at a time, with feed scroll
  restored from page state rather than `KeepAlive`. Day one is Activity, Emails, Files, Details —
  all four real, first opens, `Details` last. The composer's `+` reads the same table, and holds
  one entry.
- [Where the panel's own state is kept](tickets/008-panel-state-persistence.md) — all of it is
  `localStorage`, none of it is customization: width and collapsed are one global per-user pair,
  open sections are per doctype and store only divergences from the layout's `opened`, keyed by
  section name. One `usePanelState(doctype)` composable owns the three keys; `PanelLayout` never
  sees a width and is fully controlled by `v-model:openSections`.
- [What a save actually costs](tickets/009-save-endpoint-cost.md) — measured: `save()` calls
  `frappe.client.save` with the whole document, not either candidate the ticket named. 24 SQL
  against `set_value`'s 45, and it detects the concurrent edit `set_value` structurally cannot.
  The page must send the whole doc, normalize null against missing before diffing, and repaint
  from the response instead of reloading.
- [Component seams, names and file layout](tickets/005-component-seams.md) — one page component
  per file under `components/<page>/`, so the list's three move too; `RecordFeed` carries the
  composer band and each feed tab wraps it; `RecordPanel` is the seam plus the aside and owns
  `usePanelState`; `layout` joins the tab props. The header loses its status pill and writes
  nothing. The active tab is `?tab=` on `replace`, scroll stays page state. `isolate` on the page
  root is the one structural trap; the prototype dies in one commit once no ticket cites it.
- [What a save does when the record moved underneath it](tickets/010-save-conflict-recovery.md) —
  a conflict refetches and three-way merges: nothing colliding retries once silently, a real
  collision opens a modal that names the other person and picks per field, defaulting to theirs.
  `_link_titles` is a page-owned map written on every Link pick, never asked of a save endpoint.
  Other save errors are toast-only, and neither editing surface marks itself on failure.
- [How a post reaches the feed](tickets/007-composer-send-path.md) — `add_comment` and
  `email.make` send, but neither response is rendered: `docinfo_update` is the single writer into
  `docinfo`, because `make` returns too little to render an email from. So no de-dupe, no pending
  row, no rollback. The composer stays open and disabled until the call resolves, holding the
  draft itself. `useDocinfo` owns one page-level subscription and refetches on reconnect.
- [Mentions on a record that is not a Lead or Deal](tickets/012-mention-notification-generic.md) —
  the framework already notifies mentions generically from `Comment.after_insert`, so CRM's copy
  is deleted rather than made generic, and `get_title` names the record. The bell then unions
  `Notification Log` with `CRM Notification`, serializing into the shape the old app already
  reads. Wording, mention emails and the lost deep link to the comment are all accepted. Lands as
  a prerequisite, [Move mention notifications onto the
  framework](tickets/013-mention-notifications-to-framework.md), not a build slice.
- [The build slices, and what each one leaves working](tickets/011-slice-order.md) — nine slices,
  ten tickets in `docs/record-page-build/`, behind the live route from the second: rename and data
  layer, shell with a one-tab strip, `useDocinfo`, Activity, Emails and Files, the composer, the
  panel frame, the panel chrome, then the prototype's deletion alone. A mutation ships with its
  control and a query with its tab, no boundary shows a stub, and every file in 005's tree appears
  in exactly one ticket. Only 01, 07 and 08 need the frappe branch; if it is late the build stops
  at 06.
- [Write the build doc and cut the build tickets](tickets/006-write-build-doc.md) — the destination
  exists: [`docs/record-page-build.md`](../record-page-build.md) and ten tickets in
  [`docs/record-page-build/`](../record-page-build/), one per slice, each pointing at its slice
  rather than restating it. 011's 04a and 04b are numbered 04 and 05 there so slice and ticket share
  one integer. Nothing needed deciding; the coverage proof holds.

## The map is closed

Every question this map could see is answered, and the way to the destination is clear. What remains
is execution: the ten build tickets, and the one prerequisite that is not a slice,
[Move mention notifications onto the framework](tickets/013-mention-notifications-to-framework.md).

- [Move mention notifications onto the framework](tickets/013-mention-notifications-to-framework.md)
  — shipped, the map's one prerequisite. CRM's `notify_mentions` and its `Comment` `on_update`
  hook are deleted, and `get_notifications` unions `Notification Log` with `CRM Notification`.
  Scoping needed one call the ticket could not make: `app` is `frappe` for a Contact mention, so
  the filter is `app in ("crm", "frappe")`, not `"crm"`. The old `frontend/` needed routing,
  unroutable-doctype and socket changes the ticket had not scoped. Verified on `crm.localhost`.

## Not yet specified

<!-- empty: every question this map can see is now a ticket -->

## Out of scope

- **Most of the frappe-side framework work** — the Form Layout doctype, `surface` on
  `NavigationScope`, and the `registerRecordComponent` seam. Lands on a frappe branch, not in
  this repo. Separate effort.
  [Where the side panel's fields come from](tickets/003-side-panel-fields.md) carved out the one
  exception: `PanelLayout` also lands in `@framework/ui`, but it is **in** scope, as build slice
  one. A dense single-column mode for `FormLayout` is off the list entirely — that ticket
  killed it rather than deferring it.
- **Lead- and Deal-specific customization.** The destination is the generic record page.

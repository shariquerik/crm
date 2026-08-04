---
parent: ../map.md
labels: [wayfinder:task]
assignee: claude
blocked_by:
  [005-component-seams.md, 010-save-conflict-recovery.md, 011-slice-order.md]
status: closed
---

# Write the build doc and cut the build tickets

## Question

Nothing left to decide — this ticket writes the destination.

Produce `docs/record-page-build.md`, sibling to `record-page.md` and in its voice: settled
decisions in prose, one place to read. It carries the component seams, what owns which state,
and the slices in build order, each slice saying what it leaves working.

Then cut one implementation ticket per slice. The doc is the source of truth; a ticket points
at its slice rather than restating it, so the two cannot drift.

One implementation ticket already exists and is **not** a slice: [Move mention notifications onto
the framework](013-mention-notifications-to-framework.md), cut by [Mentions on a record that is
not a Lead or Deal](012-mention-notification-generic.md). The doc names it as a prerequisite —
backend and old-frontend work that must land before the composer can post on a generic record —
and does not fold it into the ordering.

Close the map when both exist.

## Read first

- [../map.md](../map.md), and **every closed ticket in this folder**, resolutions included.
  They are the content; this ticket is only the assembly.
- `frontend2/docs/record-page.md` — for the voice. The build doc is its sibling and should read
  as though the same hand wrote it: settled decisions in prose, each one saying what was chosen
  and what it cost. No hedging, no options left open.
- `frontend2/AGENTS.md` for the repo's writing and formatting rules.

## How to resolve

`/technical-writing`. This is the one ticket with nothing to decide — if a question comes up
while writing, that is a missed ticket, not something to settle here. Stop and say so.

## The answer must say

The ticket is done when:

- `frontend2/docs/record-page-build.md` exists, carrying the component seams, state ownership,
  and the slices in build order, each slice stating what it leaves working.
- One implementation ticket exists per slice, each **pointing at** its slice rather than
  restating it, so the doc stays the single source of truth.
- The doc names the mention-notification prerequisite ahead of the slices.
- The map's **Not yet specified** and **Out of scope** sections are accurate as of closing.

## Resolution

Transcription, as intended. Nothing came up that needed deciding.

### What exists

[`docs/record-page-build.md`](../../record-page-build.md), a sibling of `record-page.md` and in its
voice. Seven sections: the mention prerequisite, the tree and the placement rule, who owns what,
tabs, data, saving, what the framework supplies, the traps, and the slices with what each one leaves
working.

Ten tickets in [`docs/record-page-build/`](../../record-page-build/),
`01-panel-layout.md` through `10-delete-prototype.md`. Each carries the seven fields
[The build slices](011-slice-order.md) fixed — what it leaves working, what `/:doctype/:id` renders
when it lands, its files, the decisions it implements as links **by name**, its prototype citations
by file and line, the `@framework/ui` surface it consumes, and the traps binding that slice. Each
points at its slice rather than restating it, so the doc stays the single source of truth. They
carry no wayfinder label and no `parent:` — they are execution, not decisions.

### One renumbering

[The build slices](011-slice-order.md) counted **nine slices and ten tickets**, splitting slice 04
into 04a and 04b. The build doc numbers those two **04 and 05** and renumbers what follows, so slice
number and ticket number are the same integer everywhere. This ticket's own acceptance is "one
implementation ticket per slice", which the a/b form could not satisfy without a permanent
off-by-one between the doc and the folder — the exact drift the pointing-not-restating rule exists to
prevent. The doc says so in one line where the slice table sits. No slice content moved.

### The coverage proof holds

Every file in [the component seams](005-component-seams.md) tree, plus `SaveConflictDialog.vue` from
[what a save does when the record moved underneath it](010-save-conflict-recovery.md), appears in
exactly one ticket: 26 files across tickets 02 to 09, with 01 in `apps/frappe/ui` and 10 deleting
only. Every building ticket cites the prototype; ticket 10 cites nothing, which is how it passes
005's own test for being last.

### The map's own sections

**Not yet specified** was already empty and stays empty. **Out of scope** is accurate as written and
is unchanged. The map closes holding one open child,
[Move mention notifications onto the framework](013-mention-notifications-to-framework.md) — the
prerequisite, not a decision. It is named ahead of the slices in the build doc and on
[the composer's ticket](../../record-page-build/07-composer.md).

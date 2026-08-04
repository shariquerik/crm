# Slice 07 — the composer

**Leaves working:** comment and reply, with posts arriving by push.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Data** and **Tabs** before starting.

**[Move mention notifications onto the framework](../wayfinder/tickets/013-mention-notifications-to-framework.md)
must land before this slice.** Without it, `@`-mentioning a colleague in a comment on a Contact
raises after the comment is already inserted.

## When it lands

The feed carries a bottom band holding a collapsed composer: a pill that opens the editor in Reply,
a round button that opens it in Comment, and `+` for a menu of one create action per tab kind — one
entry today, _Attach a file_. Submitting a comment or a reply disables the editor and shows a
spinner; when the call resolves the composer collapses and the post appears in the feed a socket hop
later. A failure leaves the composer open with the content intact plus a toast. Switching tabs and
back keeps a half-typed draft.

## Files

**Created:**

- `src/components/record/RecordComposer.vue`
- `src/data/composer.ts` — the draft, and the arguments each send call carries
- `src/data/users.ts` — the @-mention list

**Also edits:** `src/components/record/RecordFeed.vue`, which gains the band it shipped without in
slice 05 and the four props the composer needs; `src/data/tabTypes.ts`, for the Files `create` entry
the `+` menu reads; the three feed tabs, which pass those props through.

`ComposerEmailFields.vue` was not created. `EmailComposer`'s own header rows are the same To/Cc/Bcc
block, so both it and the prototype's `ComposerField.vue` have no successor as a file.

## Decisions it implements

- [How a post reaches the feed](../wayfinder/tickets/007-composer-send-path.md) — the call per mode,
  push-only with no reconciliation, and the in-flight and failure states.
- [The tab contract](../wayfinder/tickets/004-tab-contract.md) — the `+` menu reading the same
  `TABS` table `resolveTab` reads, so what exists and what `+` offers cannot drift.
- [Component seams, names and file layout](../wayfinder/tickets/005-component-seams.md) — the draft
  as a `useRestoredRef`, since a tab switch unmounts the composer.
- [Mentions on a record that is not a Lead or Deal](../wayfinder/tickets/012-mention-notification-generic.md)
  — why the prerequisite above exists.

## Prototype

- `src/pages/prototypes/generic/GenericComposer.vue:4-39` — the collapsed band: the pill, the
  comment button, the `+` dropdown.
- `GenericComposer.vue:41-113` — expanded: the subject line, the Cc/Bcc switches, the editor and the
  tool row with Discard and Submit.
- `ComposerEmailFields.vue:3-44` — the To/Cc/Bcc rows and the watch that clears a row on the way
  out, since a row switched off has to mean nobody is copied.

## Framework surface

`CommentComposer` and `EmailComposer` from `@framework/ui/components/Composer`, consumed unchanged.
They landed after the plan was written; see its **What the framework supplies** section.

## Traps

- **`Tooltip` sets `inheritAttrs: false` and never rebinds `$attrs`**, so a `Tooltip` placed
  directly inside a `Dropdown` trigger swallows the trigger's handlers and the menu stops opening.
  Wrap the tooltipped `+` button in an element that takes the trigger props, and **give that element
  a box** — a `display: contents` wrapper measures as zero and anchors the menu at 0,0.
  `GenericComposer.vue:25-38` is the working shape.
- **The framework composers expose no in-flight state.** Submitting therefore covers the card with
  a spinner overlay and sets the editor read-only through the tiptap instance they expose, instead
  of turning the submit button into a spinner.
- **A kept draft is its text.** Attachments live inside the framework editor, so a tab switch drops
  them; the body, the subject and the recipients survive in page state.
- **No pending row.** The feed shows nothing extra while a post is in flight — no placeholder, no
  skeleton. A skeleton reintroduces exactly what push-only exists to avoid.

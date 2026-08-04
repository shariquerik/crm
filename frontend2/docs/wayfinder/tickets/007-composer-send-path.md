---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: claude
blocked_by: [004-tab-contract.md]
status: closed
---

# How a post reaches the feed

## Question

Graduated from fog by [What backs Activity, Emails and Files](001-feed-data-sources.md), which
made this sharp: freshness is **push-based**. `docinfo_update` realtime events carry
`{doc, key, action}` deltas per bucket, so a posted comment need not cost a refetch.

That turns a vague "how does sending work" into one decision. The composer submits a reply or a
comment; the feed is a client-side assembly of `docinfo` keys; the server will push a delta for
the bucket that changed. Decide:

- What the composer calls to send each of its two modes, and what it does with the response.
- Whether the feed inserts the post optimistically, waits for the `docinfo_update` delta, or
  both — and if both, how a post is reconciled with its own echo.
- What the feed shows while a post is in flight, and what it shows when one fails.
- Whether `docinfo_update` is subscribed for the whole record or per open tab, given the feed
  assembles from eleven buckets and the page holds one `docinfo`.

## Read first

Paths are relative to `frontend2/`.

- [../map.md](../map.md), then this ticket.
- [What backs Activity, Emails and Files](001-feed-data-sources.md) and its research at
  `docs/research/record-page-feeds.md` — the realtime and assembly detail is all there.
- [The tab contract](004-tab-contract.md) and its resolution, which fixes what a feed tab owns.
- `docs/record-page.md` — "The composer floats over the feed" (line 60) and the **Reply**
  paragraph (line 68) for the two modes and what each carries.
- Reference only, do not move: `src/pages/prototypes/generic/GenericComposer.vue`,
  `ComposerEmailFields.vue`, `ComposerField.vue`, `GenericTimeline.vue`.

## How to resolve

`/grilling`. Check first whether `frontend/` already subscribes to `docinfo_update` anywhere —
if it does, its handling is a candidate to put to the human rather than inventing one.

## The answer must say

- The call per mode, named.
- The optimistic-versus-push decision, and the reconciliation rule if both.
- In-flight and failure states, concretely.
- The subscription's scope and where it is set up and torn down.

## Resolution

### The call per mode

**Comment** — `crm.api.comment.add_comment(reference_doctype, reference_name, content,
attachments)` (`crm/api/comment.py:68`). It is already generic over `reference_doctype`, and it
does the File-to-Comment linking (`comment.py:86`) the composer's attach control needs. The
framework's `frappe.desk.form.utils.add_comment` was rejected: it has no attachment handling, so
choosing it means reimplementing that linking client-side, and it buys nothing until the record
page leaves this app — at which point one endpoint moves.

**Reply** — `frappe.core.doctype.communication.email.make` with `doctype`, `name`,
`send_email: 1`, `sender`, `sender_full_name`, `recipients`/`cc`/`bcc` joined with `, `, plus
`attachments` as File names. `frontend/src/components/CommunicationArea.vue:216` already calls it
exactly this way and is the shape to copy.

Neither response is rendered. `add_comment` returns the Comment doc and `make` returns
`{name, emails_not_sent_to}` (`frappe/core/doctype/communication/email.py:237`) — see below for
why that asymmetry decides the insert path. The response is awaited **only** for errors and for
`emails_not_sent_to`, which becomes a warning toast. Nothing else ever tells the user an address
failed validation.

### Push, not optimistic

**`docinfo_update` is the single writer into `docinfo`.** A post you made and a post a colleague
made travel the identical path; the send call's response never enters the feed.

This is not a preference, it is what keeps the two modes symmetric. `add_comment` returns the
Comment doc, so a response-written entry would work for comments — but `make` returns a name and
a string, so an email rendered from its response would be a stub missing sender, recipients,
timestamps and attachments, and would need a `Communication` fetch that duplicates the delta
already in flight. Response-writing means one path for comments and a second for emails.

Push-only therefore needs **no reconciliation rule at all** — no de-dupe by `name`, no pending
entry in the renderer, no rollback on failure, and no chance of two writers disagreeing about the
shape of a row. Optimistic insertion was rejected for the same reason plus the state it costs:
the visible gap is one socket hop after the call resolves, and the composer collapsing is the
immediate feedback.

Both emitters publish `after_commit=True` to the document's room (`comment.py:94`,
`communication.py:305`), and the sender is in that room, so the echo is reliable.

The handler splices by `action`, filtering first on `doc.reference_doctype` and
`doc.reference_name` matching the page's. `frappe/public/js/frappe/form/form.js:2306` is the
reference implementation — `add` pushes, `update` splices in place at the index found by `name`,
`delete` splices out. Today's CRM handler (`Activities.vue:592`) refetches everything on any
`comments` event; do not copy that.

**One bucket fans out.** Attaching a file posts a Comment with `comment_type: Attachment`, so the
echo lands on `attachment_logs` (`comment.py:82`) — but the Files tab runs its own `File` query
for the timestamps `docinfo.attachments` lacks. So the handler splices as usual **and** reloads
the Files query when the key is `attachment_logs`. Still one socket handler.

### In flight, and on failure

Submit disables the editor and swaps the button label for a spinner. **The composer stays open
until the call resolves**, then collapses and clears.

The feed shows nothing extra in the gap — no placeholder, no skeleton row. A skeleton was
rejected because it reintroduces the pending row that push-only exists to avoid.

A failure leaves the composer open with the content intact, plus an error toast. **The draft is
never held anywhere but the open composer**, which is what makes this cheaper than collapsing
immediately: there is no draft to restore, because it was never taken away.

### The subscription

Page level, owned by **`useDocinfo`** — `doc_subscribe` and the `docinfo_update` handler set up
and torn down beside the state they write. Teardown emits `doc_unsubscribe` and passes the
handler reference to `socket.off`, since a bare `off('docinfo_update')` would kill other
listeners.

Per-tab was rejected: tabs unmount on switch ([The tab contract](004-tab-contract.md)), so a
per-tab subscription goes deaf whenever you look at another tab, and the eleven buckets do not
partition by tab anyway.

Push-only makes the socket load-bearing, so **`useDocinfo` also refetches `docinfo` on socket
reconnect**. One `getdoc` repairs every delta missed while offline — colleagues' posts as much as
your own.

### One defect found, not fixed

`notify_mentions` runs from a `Comment` `on_update` doc_event (`crm/hooks.py:178`), not from the
endpoint, so it fires whichever call the composer makes. At `crm/api/comment.py:24` it reads
`reference_doc.organization or reference_doc.lead_name` for any doctype that is not a Lead, so
`@`-mentioning someone on a Contact raises. No choice of endpoint dodges it. Cut as
[Mentions on a record that is not a Lead or Deal](012-mention-notification-generic.md).

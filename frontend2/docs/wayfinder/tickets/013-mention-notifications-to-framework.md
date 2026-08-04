---
parent: ../map.md
labels: [implementation]
assignee: claude
blocked_by: []
status: closed
---

# Move mention notifications onto the framework

Implementation, not a decision. Cut by
[Mentions on a record that is not a Lead or Deal](012-mention-notification-generic.md), which
holds the reasoning for every choice below — read it first and do not relitigate it here.

**A prerequisite, not a build slice.** It is backend plus the *old* `frontend/`, it depends on no
seam decision this map made, and it must land before the record page's composer can post a comment
on a Contact without raising.

Both halves ship in one change. Half one alone leaves mentions missing from a bell that has to
keep working.

## Half one — delete CRM's mention notification

The framework already notifies mentions for every comment on every doctype, from
`Comment.after_insert` (`frappe/core/doctype/comment/comment.py:59`). CRM's copy is a duplicate
that raises on any doctype without `organization` or `lead_name`.

- Delete `notify_mentions` and `on_update` from `crm/api/comment.py:11-55`.
- Delete the `Comment` `on_update` entry at `crm/hooks.py:178`. The `after_insert` entry
  (`crm.utils.on_comment_insert`) stays.
- Drop whatever imports that orphans — `notify_user`, `get_fullname`, and `extract_mentions` if
  nothing else in the app calls it. Check before removing it.

No fallback chain is written. `get_title(doctype, name)` (`notification_log.py:114`) already names
the record: title field, falling back to `name`.

## Half two — the bell reads both sources

`crm/api/notifications.py` queries `CRM Notification` only, so it must learn a second source.

- `get_notifications` unions `Notification Log` (mentions, scoped by its `app` field — see
  `notification_log.py:56`) with `CRM Notification` (Task, Assignment, WhatsApp), merged and
  sorted by `creation` descending.
- `mark_as_read` writes to whichever doctype owns the row.
- `Notification Log` rows are serialized **into the payload shape `Notifications.vue` already
  consumes** — `from_user`, `type`, `read`, `notification_text`, `hash`, route fields. The old bell
  must not learn a second row format.
- Replace the `"deal" if reference_doctype == "CRM Deal" else "lead"` hard-code
  (`notifications.py:32`) with routing on `document_type`/`document_name` at the generic
  `/:doctype/:id`, since a mention can now point at a Contact.
- `hash` is empty for mention rows. The deep link to the comment is knowingly given up; see the
  resolution for why it cannot be recovered app-side.

## Acceptance

`frontend/` coexists with `frontend2` until `frontend2` can replace it, so the bar is that the old
bell keeps working unchanged **except** for mention routing.

- A comment mentioning a colleague on a **Contact** posts cleanly and notifies. This is the defect
  that cut the ticket.
- The mention appears in the old bell, reads as unread, marks as read, and opens the record.
- Task, Assignment and WhatsApp notifications are untouched — same rows, same order, same routing.
- Mentions on a Lead and a Deal still notify, and still route to their pages.

Three changes are expected and accepted, not defects: the wording gains the raw doctype
("in CRM Lead Acme"), a mention now sends an email, and clicking one lands at the top of the feed
instead of on the comment.

## Resolution

Shipped. Both halves landed together, and the acceptance list was exercised against
`crm.localhost` rather than read.

### Half one — CRM's mention notification is gone

`crm/api/comment.py` lost `on_update`, `notify_mentions` and `extract_mentions`, along with the
`BeautifulSoup`, `frappe._` and `notify_user` imports those three orphaned. `notify_user` still
has two callers (`crm/api/whatsapp.py`, `crm/api/todo.py`) so it stays; `extract_mentions` had
none outside the deleted function. The `Comment` `on_update` entry left `crm/hooks.py`; the
`after_insert` entry (`crm.utils.on_comment_insert`) is untouched.

One compatibility fact the ticket did not name, and the deletion depends on: the two
`extract_mentions` read **different** markup. CRM's matched `span[data-type="mention"]`; the
framework's matches `class="mention"` and reads `data-id`. frappe-ui's mention node emits both
(`mention-extension.ts:97-98`), so the framework picks up every mention CRM's copy did. It also
filters recipients on `User.allowed_in_mentions`, which CRM's did not — that field defaults to
`1`, so no existing user drops out.

### Half two — the bell unions two doctypes

`get_notifications` splits into `_get_crm_notifications` and `_get_mention_notifications`,
concatenated and sorted by `creation` descending. `mark_as_read` writes to both, matching a
`Notification Log` row on its `name` — which is what the old bell already passes, since mention
rows serialize their log name as `notification_type_doc`.

Mention rows are serialized into the payload the old bell already consumes. Two fields are new
and additive: `document_type`/`document_name` for the generic route, and `source` naming the
owning doctype. `notification_text` wraps the framework's `subject` in the same
`mb-2 leading-5 text-ink-gray-5` div CRM's producer wrote, so the row renders unchanged through
`sanitizeHTML`.

### One decision the ticket could not have made

The ticket said to scope `Notification Log` by its `app` field, but `app` follows the reference
doctype's owning app — measured on the site, a mention on Contact resolves to `frappe` and only
CRM doctypes resolve to `crm`. An `app == "crm"` filter would have dropped the exact case the
acceptance list leads with. Settled with the human: the filter is `type == "Mention"` and
`app in ("crm", "frappe")` (`MENTION_APPS`). That admits Contact and Organization, and keeps
another installed app's mentions — Gameplan, on this bench — out of the CRM bell. It also admits
a mention on any other frappe-owned doctype, which is accepted as a small, quiet leak.

### What the old frontend needed after all

The ticket scoped half two to `notifications.py`, but three things in `frontend/` broke without
changes, in both `components/Notifications.vue` and `pages/MobileNotification.vue`:

- **Routing.** `getRoute` hard-coded `leadId`, falling to `dealId` for one route name. It now
  derives the param from `route_name` (`Contact` → `contactId`), which is uniform across all
  four routes and so replaces the branch rather than extending it.
- **Unroutable doctypes.** `frontend/` has no generic `/:doctype/:id`, so a mention on a doctype
  with no page here serializes `route_name: None` and the row renders as a plain `div`. The
  `MENTION_ROUTES` map holds the four that do have pages.
- **Live refresh.** `Notification Log.after_insert` publishes `notification`; the bell only
  listened for `crm_notification`, so mentions would have needed a reload to appear. Both
  consumers now listen for the second event.

Two smaller fixes rode along: the `v-for` key was `n.comment`, undefined for every mention row,
and is now `n.name`; and `MobileNotification.vue` built its hash as
`'#' + notification.comment || ...`, which produced `"#undefined"`, and now reads `n.hash`.

### Verified on crm.localhost

- A comment mentioning a colleague on **Contact `Ravi Sharma`** inserts cleanly — the raising
  `reference_doc.organization` path is gone. Same for a Lead and a Deal.
- All three produced `Notification Log` rows for the mentioned user, with `app` of `frappe`,
  `crm`, `crm` respectively — all three inside the filter.
- `get_notifications` as the recipient returned 27 rows: 24 `Assignment` from `CRM Notification`
  and 3 `Mention` from `Notification Log`, correctly interleaved by `creation`. The 24
  Assignment rows are byte-identical to before.
- `mark_as_read(<log name>)` marked one mention read and left every Assignment row alone;
  `mark_as_read()` cleared both sources.
- **No** new `CRM Notification` row of type `Mention` was written — the deleted producer is
  genuinely dead.
- `eslint` and `prettier --check` clean on both changed `.vue` files.

The three accepted regressions from
[Mentions on a record that is not a Lead or Deal](012-mention-notification-generic.md) all
showed up as predicted: the subject reads "in **CRM Lead** Grace Torres", the log emails, and
`hash` is empty.

### Left behind

The test comments and their logs were deleted after the run. Marking all as read, however,
cleared 24 pre-existing unread `Assignment` notifications for `emily.demo@example.com` on the
demo site, and which were unread was not recorded first — not recoverable.

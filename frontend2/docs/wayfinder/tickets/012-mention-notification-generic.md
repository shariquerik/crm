---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: claude
blocked_by: []
status: closed
---

# Mentions on a record that is not a Lead or Deal

## Question

Cut by [How a post reaches the feed](007-composer-send-path.md), which found this while naming
the composer's comment call. `@`-mentioning a colleague in a comment on a generic record raises.

`notify_mentions` runs from a `Comment` `on_update` doc_event (`crm/hooks.py:178`), not from an
endpoint, so **every** comment posted from the record page goes through it whatever the composer
calls. At `crm/api/comment.py:24` it builds the notification text from

```python
name = (
    reference_doc.lead_name
    if doctype == "lead"
    else reference_doc.organization or reference_doc.lead_name
)
```

which assumes the reference document is a CRM Lead or Deal. On a Contact — or any other doctype
the generic record page opens — that attribute does not exist and the access raises. The comment
itself is already inserted by then, so the failure surfaces as a broken save on a post that
partly succeeded.

Two lines above it, `doctype.startswith("CRM ")` strips the prefix for the notification's wording,
which is the same assumption in a form that degrades quietly rather than raising.

Decide:

- What names a record in a mention notification when the doctype has no `lead_name` or
  `organization` — the title field, the `name`, something the doctype declares. And what the
  wording becomes when the doctype is not a CRM one.
- Whether a mention notification is attempted at all for doctypes outside the CRM set, or
  skipped.
- Whether the fix is defensive (a fallback where the attributes are missing) or structural
  (mention notification stops being CRM-shaped).
- Whether `on_update` is even the right hook, given it fires on edits to an existing comment as
  well as the first insert.

This is backend Python in the `crm` app, so unlike the framework work in **Out of scope** it does
land in this repo. The map still ships no code: resolve it to a decision and an implementation
ticket, not a patch.

## Read first

Paths are relative to the `crm` app root.

- [../map.md](../map.md), then this ticket.
- [How a post reaches the feed](007-composer-send-path.md) — its resolution names the composer's
  calls and the "One defect found" section that cut this.
- `crm/api/comment.py:11-55` — `on_update`, `notify_mentions` and `extract_mentions`.
- `crm/hooks.py:176-179` — the `Comment` doc_events that make this endpoint-independent.
- `crm/fcrm/doctype/crm_notification/crm_notification.py` — `notify_user` and what a
  CRM Notification requires.

## How to resolve

`/grilling`. Establish first whether CRM Notification is the right vehicle for a mention on a
non-CRM doctype at all, or whether the framework already has a mention notification this should
defer to — that answer may make the rest moot.

## The answer must say

- What names the record, per doctype, with the fallback chain spelled out.
- Whether non-CRM doctypes notify or skip.
- Which hook fires it.
- Whether it lands as its own implementation ticket or inside a build slice.

## Resolution

### The framework already does this, so CRM stops doing it

`Comment.after_insert` calls `frappe.desk.notifications.notify_mentions`
(`frappe/core/doctype/comment/comment.py:59`) for **every** comment, on every doctype, and has
all along. It names the record with `get_title(doctype, name)`
(`notification_log.py:114`) — the doctype's title field, falling back to `name` — writes a
**Notification Log** row and sends an email.

So there is nothing to make generic. CRM's `notify_mentions` is a second, CRM-shaped copy of a
notification the framework already sends, and it is **deleted**: `crm/api/comment.py`'s
`notify_mentions` and `on_update`, plus the `Comment` `on_update` entry at `crm/hooks.py:178`.
The raising `reference_doc.organization` line goes away rather than gaining a fallback chain, and
no fallback chain is designed — `get_title` is the answer to "what names the record".

The `Comment` `after_insert` hook (`crm.utils.on_comment_insert`) is untouched.

### The bell reads both sources

CRM's bell could not see any of this: `crm/api/notifications.py:7` queries `CRM Notification` and
nothing else. Deleting the producer without changing the reader would drop mentions out of the
bell entirely.

So `get_notifications` becomes a **union** — `Notification Log` for mentions, `CRM Notification`
for Task, Assignment and WhatsApp — merged and sorted by `creation`; `mark_as_read` writes to
whichever doctype owns the row. This frappe branch's `Notification Log` already carries an `app`
field derived from the reference doctype's owning app, "used to scope app-specific notification
panels" (`notification_log.py:56`), which is the filter the union reads on.

Migrating the other three types and retiring `CRM Notification` was rejected: it touches three
more producers and their routing, the record page waits on none of it, and — see below — the old
app needs that doctype for as long as it lives. The union is the **steady state**, not a stopgap.

### The old frontend must not notice

`frontend/` coexists with `frontend2` until `frontend2` can replace it, so its bell keeps working
throughout. `Notification Log` rows are therefore serialized **into the payload shape
`Notifications.vue` already consumes** (`from_user`, `read`, `notification_text`, `hash`, route
fields) — the old bell never learns a second row format.

Its one real change is routing. `notifications.py:32` hard-codes
`"deal" if reference_doctype == "CRM Deal" else "lead"`; a mention can now point at a Contact, so
`document_type`/`document_name` route at the generic `/:doctype/:id` instead.

### What is lost, and what changes

**The deep link to the comment.** Today the bell lands on `#<comment-name>` (`get_hash`,
`notifications.py:59`) because `CRM Notification.notification_type_doc` holds the Comment. The
framework's payload is `{type, document_type, document_name, subject, from_user, email_content}`
— the record, never the comment — and its `link` field is left unset. A CRM hook cannot recover
it either, since `enqueue_create_notification` runs the insert in a background job with no comment
context. Accepted: a mention opens the record with the feed at the top. Adding a seam upstream so
the comment can be linked is a possible future change, not part of this.

**The wording.** The framework writes "{sender} mentioned you in a comment in **CRM Lead** Acme"
where CRM wrote "in lead Acme" — it uses the raw doctype, CRM stripped the prefix and lowercased.
Accepted as-is. Fixing it means either editing `frappe/desk/notifications.py`, which the map put
out of scope, or rewriting the subject on read, which reintroduces the CRM-shaped producer just
deleted.

**Mentions start emailing.** `Notification Log.after_insert` emails when the type is in the user's
`email_notification_types` allow-list, and new users are seeded with every enabled type
(`notification_settings.py:113`), so Mention is opt-out. CRM's `notify_user` never sent mail.
Accepted: the only suppression lever, `notification_skip_email_types`, is read **site-wide**, so
using it would kill mention emails for every app on the bench to buy one CRM preference — and an
unwanted mention email is already a per-user opt-out in Notification Settings.

**Self-mention stays silent**, unchanged: `make_notification_logs` skips
`for_user == from_user` unless the type is in `notification_self_notify_types` (`["Alert"]`),
which matches CRM's `owner == assigned_to` guard.

### Which hook

`Comment.after_insert`, the framework's — one hop earlier than CRM's `on_update`, and it no
longer re-fires on every subsequent edit of a comment. The question of whether `on_update` was the
right hook dissolves with the code that used it.

### Where it lands

One standalone implementation ticket,
[Move mention notifications onto the framework](013-mention-notifications-to-framework.md), done
**before** record-page work starts. Both halves ship together: deleting the producer alone leaves
a bell that has to keep working with mentions missing from it.

It is a prerequisite, not a build slice — it is backend plus the *old* frontend, and depends on
none of this map's seam decisions. [Write the build doc and cut the build
tickets](006-write-build-doc.md) cites it as a prerequisite rather than a step.

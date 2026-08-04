# What backs Activity, Emails and Files

Research for [ticket 001](../wayfinder/tickets/001-feed-data-sources.md). Every claim cites
source in this bench: `apps/frappe` (framework), `apps/crm/crm` (python app),
`apps/crm/frontend` (the existing CRM UI, which renders these feeds today).

## Short answer

There is **one generic endpoint that carries all three tabs at once** —
`frappe.desk.form.load.getdoc` — and it is the same endpoint that already has to be called for
the record's document chrome. Everything the three tabs need is in its `docinfo`, except paging
past the first page of emails and except three File fields the Files tab wants.

The existing `frontend/` does *not* call it. It calls `crm.api.activities.get_activities`, which
runs `get_docinfo` **server-side** and reshapes it. That endpoint is **Lead- and Deal-only** and
throws for every other doctype, so `frontend2`'s generic `/:doctype/:id` cannot use it.

`frontend2` today fetches the record with `frappe.client.get`
(`src/data/resources.ts:33`), which returns no `docinfo` at all. Moving that resource to
`getdoc` is what unlocks all three feeds.

## The one call: `frappe.desk.form.load.getdoc`

`getdoc(doctype, name)` — whitelisted at `frappe/desk/form/load.py:21-57`. Two args, both
required. It runs `onload`, applies field-level read permissions, records a view, then calls
`get_docinfo(doc)` (`load.py:51`).

**It does not return its payload.** It appends the document to `frappe.response.docs`
(`load.py:57`) and `get_docinfo` assigns `frappe.response["docinfo"]` (`load.py:139`). Both ride
on the response envelope, not in `message`.

This matters for frappe-ui. `call()` returns `data.message` normally, but short-circuits and
returns the **whole response object** when `data.docs` is present
(`node_modules/frappe-ui/src/utils/call.ts:62-64,80`). So:

- `getdoc` → returns `{ docs: [doc], docinfo: {...}, _link_titles: {...} }`. Usable.
- `get_docinfo` **called on its own** (it is separately whitelisted, `load.py:91-96`, and accepts
  `doctype` + `name`) sets no `docs` key, so frappe-ui returns `data.message`, which is
  `undefined`. Calling `get_docinfo` directly through `call()`/`createResource` silently yields
  nothing. Use `getdoc`, or a raw fetch.

`getdoc` also returns `_link_titles` (`load.py:472-476`) — display titles for Link fields, which
the side panel wants anyway.

### What `docinfo` contains

Assembled at `load.py:113-137`, one dict:

| key | source | limit |
| --- | --- | --- |
| `comments` | `Comment` where `comment_type = "Comment"`, markdown-rendered (`load.py:152-162`) | none |
| `versions` | `Version` for the doc, `creation desc` (`load.py:236-245`) | **10, hard** |
| `communications` | `Communication`, non-`Automated Message` (`load.py:102-108`) | **21 total, shared** |
| `automated_messages` | `Communication` where type is `Automated Message` (`load.py:103-105`) | same 21 |
| `attachments` | `File` attached to the doc (`load.py:187-201`) | none |
| `attachment_logs` | `Comment` of type `Attachment` / `Attachment Removed` (`load.py:167-168`) | none |
| `assignment_logs` | `Comment` of type `Assigned` / `Assignment Completed` (`load.py:165-166`) | none |
| `info_logs` | `Comment` of type `Info` / `Edit` / `Label` (`load.py:169-170`) | none |
| `like_logs`, `workflow_logs`, `shared` (as logs) | `Comment` of the matching types (`load.py:163-174`) | none |
| `views` | `View Log`, `creation desc` (`load.py:414-427`) | none |
| `milestones` | `Milestone` for the doc (`load.py:179-184`) | none |
| `additional_timeline_content` | whatever apps register on the `additional_timeline_content` hook (`load.py:457-466`) | app-defined |
| `assignments` | open `ToDo`s (`load.py:396-406`) | none |
| `permissions`, `shared`, `tags`, `is_document_followed`, `document_email`, `user_info` | `load.py:125-134` | — |

"none" means genuinely unbounded: `frappe.get_all` forces `limit_page_length = 0`
(`frappe/__init__.py:1313-1315`), and `DatabaseQuery` emits no `limit` clause when it is unset
(`frappe/model/db_query.py:190,1476`). A record with 4000 comments returns 4000 comments.

## Activity

**An assembly, done server-side, delivered in one call.** Frappe has no "timeline" endpoint. The
desk client builds the mixed feed itself out of `docinfo` keys, in
`frappe/public/js/frappe/form/footer/form_timeline.js:162-179` — `prepare_timeline_contents()`
pushes, in order:

1. a synthetic **created** entry from `doc.creation` / `doc.owner` (`form_timeline.js:140-149`)
2. a synthetic **last edited** entry from `doc.modified` / `doc.modified_by` (`:151-160`)
3. `docinfo.communications` + `docinfo.automated_messages` (`:197-226`)
4. `docinfo.comments`
5. `docinfo.views`, then `docinfo.versions` (`:168-169`)
6. `docinfo.shared`, `workflow_logs`, `like_logs`, `additional_timeline_content`,
   `assignment_logs`, `attachment_logs`, `info_logs`, `milestones` (`:170-177`)

So: **eleven sources, one HTTP call.** The client sorts and renders; nothing is fetched per
source.

CRM does the same assembly in python instead, in `crm/api/activities.py`. `get_activities(name)`
(`activities.py:13-20`) dispatches on whether the name is a Deal or a Lead and **throws
`DoesNotExistError` for anything else** — this is the reason it is unusable for a generic record
page. Inside (`activities.py:23-174` for Deal, `:177-315` for Lead) it calls `get_docinfo` and
folds `versions` → `changed`/`added`/`removed` entries with resolved field labels
(`:68-119`), `comments` → `comment` (`:121-131`), `communications + automated_messages` →
`communication` (`:133-153`), `attachment_logs` → `attachment_log` (`:155-164`), plus a
synthetic `creation` entry (`:56-64`). It then appends CRM-only sources: `CRM Call Log`,
`FCRM Note`, `CRM Task`, `File` (`:166-169`). It returns a **five-tuple**
`(activities, calls, notes, tasks, attachments)`, which the UI unpacks by position
(`frontend/src/components/Activities/Activities.vue:540-542`).

Two behaviours in that python worth copying or deliberately not copying:

- **Consecutive version entries by the same owner are grouped** into one entry with
  `other_versions` (`activities.py:339-373`). The desk client does not do this.
- Deal activities **include the originating Lead's whole activity list** (`activities.py:52-53`),
  so a converted Deal's feed starts with the Lead's history.

For a generic feed the version entries need field labels, which means the doctype meta
(`activities.py:30-32` reads `frappe.get_meta(...).fields` for `label` and `options`). That work
has to happen somewhere — server-side as CRM does it, or client-side against meta the record page
already loads.

### Paging

- **Comments, versions, logs: no paging exists.** Versions are capped at 10 by
  `get_versions` (`load.py:244`) with no whitelisted endpoint to fetch more; the desk timeline
  simply shows those 10. Past that, the only route is a generic list query against `Version`
  (`ref_doctype`, `docname`).
- **Comments and every log kind are unbounded and unpaged** — you get all of them or you write
  your own list query against `Comment`. `frappe.desk.form.load.get_comments` (`load.py:257`)
  exists but is **not whitelisted**.
- Only communications page. See below.

## Emails

Confirmed: `Communication` records, filtered as the ticket assumed, but with one extra join.

`_get_communications` → `get_communication_data` (`load.py:291-393`) unions two queries:

1. `tabCommunication` where `communication_type IN ('Communication', 'Automated Message')` **and**
   `reference_doctype = %(doctype)s AND reference_name = %(name)s` (`load.py:333-341`)
2. the same, joined through `tabCommunication Link` on `link_doctype` / `link_name`
   (`load.py:344-353`) — this is how an email attached to a Contact surfaces on the Deal

ordered `communication_date DESC`, with `LIMIT`/`OFFSET`.

Fields returned (`load.py:311-318`): `name`, `communication_type`, `communication_medium`,
`communication_date`, `content`, `sender`, `sender_full_name`, `cc`, `bcc`, `creation`, `subject`,
`delivery_status`, `_liked_by`, `reference_doctype`, `reference_name`, `read_by_recipient`,
`recipients`. Plus `attachments` — a **JSON string**, not a list, of `{file_url, is_private}` for
each `File` attached to that Communication (`load.py:293-301`; the desk client parses it at
`form_timeline.js:288-289`).

CRM surfaces exactly this set (`activities.py:139-150`) and renders the Emails tab by filtering
the merged activity list on `activity_type === 'communication'`
(`Activities.vue:636-640`) — i.e. **the Emails tab is a client-side filter of the Activity data,
not a second fetch.**

### Paging

This is the only feed that pages, and it pages by offset.

- `get_docinfo` asks for `limit=21` (`load.py:102`) — 20 to show, the 21st as a has-more probe.
  The desk client pops it and appends a "Load More Communications" row
  (`form_timeline.js:203-223`).
- More pages come from `frappe.desk.form.load.get_communications(doctype, name, start, limit)`,
  whitelisted at `load.py:248-254`. The desk client passes
  `start = communications.length + automated_messages.length - 1` and `limit: 21`
  (`form_timeline.js:253-265`).
- Note the 21 is **shared** between `communications` and `automated_messages` — they are one
  query split by type after the fact (`load.py:102-108`), so a record noisy with automated
  messages shows fewer real emails on page one.
- Offset paging on a `UNION` ordered by `communication_date` is not stable against concurrent
  inserts. Expect the occasional duplicate or skip at a page boundary.

## Files

**The claim at `record-page.md:57` is correct, with a caveat that changes the answer.**

`docinfo.attachments` is `get_attachments(doctype, name)` (`load.py:187-201`) — every `File`
where `attached_to_doctype` / `attached_to_name` match, unlimited, no extra call. So yes,
attachments arrive with `getdoc`.

The caveat: the fields are `name`, `file_name`, `file_url`, `file_type`, `file_size`,
`is_private`, `attached_to_field`, `folder`. **No `creation`, no `modified`, no `owner`.**

The prototype's Files tab is a timeline like the others, and CRM's `AttachmentArea.vue` renders
a timestamp per file (`frontend/src/components/Activities/AttachmentArea.vue:35`) and sorts by
`modified` (`Activities.vue:655-657`). It can do that because CRM has its *own* attachment
query — `crm/api/activities.py:318-336` asks `File` for the same fields **plus `modified`,
`creation`, `owner`**.

So: if the Files tab shows only name, type, size and privacy, it needs **no fetch of its own**.
If it shows *when* and *by whom* — which the settled shape implies, since it is a feed — it needs
one, because `docinfo` cannot supply those. Options, cheapest first:

1. a generic list query against `File` filtered on `attached_to_doctype`/`attached_to_name` with
   the fields you want — one extra call, and the only one that gets `owner`
2. `frappe.desk.form.load.get_filtered_attachments(dt, dn, filters)` — whitelisted
   (`load.py:204-233`), permission-checked, `limit=0`, but it hardcodes the **same field list**,
   so it does not solve the missing columns
3. reuse `docinfo.attachment_logs` for the *when* and *who* — these are `Comment` rows of type
   `Attachment` with `creation` and `owner`, and CRM parses the filename out of their HTML
   (`activities.py:498-519`). Fragile; it is HTML scraping, and it loses files attached before
   logging existed

Recommend option 1, and treat the Files tab as the one tab with a fetch of its own.

## Cost of one tab versus all three

There is **no per-tab endpoint** on the generic path. `getdoc` is monolithic: it always runs
every query in the table above, whichever tab is showing. Concretely, one `getdoc` is roughly a
dozen queries — the document, `Comment` (once, split into seven buckets client-side),
`Version`, the `Communication` union, `File`, `ToDo`, `View Log`, `Milestone`, `Tag Link`,
share, follow, plus permissions and `_link_titles` per Link field.

Consequences for slicing:

- **Asking for one tab costs the same as asking for all three.** There is nothing to save by
  lazy-loading a tab, and switching tabs should cost zero requests. Fetch `getdoc` once, render
  all three from it.
- The record page **has to call `getdoc` anyway** for assignment, tags, share, follow and
  permissions (`record-page.md:57`). The feeds are free riders on a call already being made.
- The genuinely incremental fetches are exactly two: the **next page of emails**
  (`get_communications`), and the **File list** if the Files tab shows uploader or timestamp.
- `frappe.client.get` in `src/data/resources.ts:33` should become `getdoc`. It is strictly less
  than `getdoc` returns, and the response is a superset, so nothing downstream loses a field.

Cost note on CRM's endpoint, for the record: `get_activities` calls `get_attachments` **once per
comment and once per communication** (`activities.py:128,147,269,288`) — an N+1 of up to 41
extra queries on a busy record — and calls `get_linked_calls(name)` three times in a row
(`activities.py:166-168`). Do not copy that shape.

## Keeping the feed fresh

Frappe pushes deltas rather than expecting a refetch. `Comment.notify_change`
(`frappe/core/doctype/comment/comment.py:80-100`) and `Communication.notify_change`
(`frappe/core/doctype/communication/communication.py:303-310`) both publish a `docinfo_update`
event carrying `{doc, key, action}` where `key` names the `docinfo` bucket (`comments`,
`communications`, `attachment_logs`, `assignment_logs`, `like_logs`) and `action` is
`add` / `update` / `delete`. It is routed to the document's room
(`frappe/realtime/__init__.py:60-61`), which a client joins by emitting `doc_subscribe`.

The desk client splices the delta into its local `docinfo` (`frappe/public/js/frappe/form/form.js:2305`
onward). CRM does the blunter thing — on any `comments` event it refetches everything
(`Activities.vue:595-602`). Either works; the delta path means a posted comment need not cost a
round trip.

## Composer endpoints, for the neighbouring ticket

- Send an email: `frappe.core.doctype.communication.email.make`
  (`frontend/src/components/CommunicationArea.vue:216`)
- Post a comment: `crm.api.comment.add_comment(reference_doctype, reference_name, content,
  attachments)` (`crm/api/comment.py:68-89`), which wraps `frappe.desk.form.utils.add_comment`
  and additionally attaches `File`s to the Comment and notifies `@`-mentions
  (`crm/api/comment.py:16-55`). Returns the Comment document.

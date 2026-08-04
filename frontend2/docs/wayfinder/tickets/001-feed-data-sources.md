---
parent: ../map.md
labels: [wayfinder:research]
assignee: shariquerik
blocked_by: []
status: closed
---

# What backs Activity, Emails and Files

## Question

The record page shows three feed tabs. Which frappe APIs serve them?

- **Activity** — the mixed feed: comments, field changes, and whatever else frappe folds into a
  timeline. Is this one call or an assembly of several?
- **Emails** — `Communication` records against the record.
- **Files** — `File` records. `record-page.md:57` says attachments already arrive inside
  `getdoc`'s `docinfo`, so this tab may need no fetch of its own.

For each, answer: the endpoint, the shape it returns, whether it pages and how, and what it
costs to ask for a single tab rather than all of them. Note where the existing `frontend/` app
already calls these — it renders the same feeds today and is the cheapest source of truth.

Nothing about the feed can be sliced until this is known.

## Resolution

Full findings, with file and line for every claim, in
[docs/research/record-page-feeds.md](../../research/record-page-feeds.md).

**All three tabs come from one call** — `frappe.desk.form.load.getdoc(doctype, name)`
(`frappe/desk/form/load.py:21`). The page has to make it anyway for assignment, tags, share and
follow, so the feeds are close to free.

- **Activity** is not an endpoint. It is eleven `docinfo` keys assembled client-side —
  comments, versions, communications, views, shares, likes, workflow, the assignment, attachment
  and info logs, milestones, plus synthetic created and edited entries. Desk does this at
  `form_timeline.js:162`. Zero extra fetches.
- **Emails** are `Communication` rows with `communication_type IN ('Communication',
  'Automated Message')`, unioned over `reference_doctype`/`reference_name` and
  `Communication Link` (`load.py:333`). The only feed that pages: `docinfo` carries `limit=21`,
  and more arrives through `frappe.desk.form.load.get_communications(doctype, name, start,
  limit)`, offset-style. That 21 is shared with `automated_messages`.
- **Files** — `record-page.md:57` is right that `docinfo.attachments` is unlimited and free,
  but wrong that it suffices. Its field list carries no `creation`, `modified` or `owner`
  (`load.py:187`), and the settled shape renders Files as a feed with timestamps. So Files needs
  one list query of its own against `File`. `get_filtered_attachments` does not help — same
  hardcoded fields.

**Cost of one tab equals the cost of three.** `getdoc` is monolithic. Lazy-loading a tab saves
nothing, and a tab switch should cost zero requests.

Three findings that bear on other tickets:

- `frontend2` fetches the record with `frappe.client.get` today (`src/data/resources.ts:33`),
  which carries no `docinfo`. Swapping that one resource to `getdoc` unlocks all three feeds and
  the panel's chrome at once.
- `crm.api.activities.get_activities` — what today's `frontend/` calls — is **Lead- and
  Deal-only and raises otherwise** (`crm/api/activities.py:13`), so it cannot back a generic
  record page. Its shape is not worth copying either: it re-queries attachments per comment and
  per communication, and calls `get_linked_calls` three times.
- Freshness is push-based. `docinfo_update` realtime events carry `{doc, key, action}` deltas
  per bucket, so a posted comment need not cost a refetch.

**One trap.** `getdoc` returns its payload on `frappe.response.docs` and `docinfo`, not on
`message`. frappe-ui's `call()` only copes because `docs` is present
(`frappe-ui/src/utils/call.ts:62`). Calling `get_docinfo` on its own through frappe-ui returns
`undefined`.

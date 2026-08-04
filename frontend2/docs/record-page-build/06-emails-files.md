# Slice 06 — Emails and Files

**Leaves working:** four real tabs, read-only.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Tabs** and **Data** before starting.

Each is a tab component and a query against a `RecordFeed` that already exists, so they share a
slice: splitting them buys a boundary where nothing is learned.

## When it lands

The strip reads Activity · Emails · Files · Details, all four real, no stubs. Emails shows the
record's `Communication` rows and pages back through older ones as the feed scrolls. Files lists the
record's attachments as a feed with timestamps and owners. Switching between all four costs zero
requests.

## Files

**Created:**

- `src/components/record/tabs/EmailsTab.vue`
- `src/components/record/tabs/FilesTab.vue`

**Also edits:** `src/data/resources.ts`, to add the `get_communications` pager and the `File` list
query — a tab's query ships with its tab, not with slice 02's `recordResources`;
`src/data/recordLayout.ts` and `src/data/tabTypes.ts`, for the two new entries;
`src/composables/useDocinfo.ts`, so the handler reloads the Files query when the bucket is
`attachment_logs`.

## Decisions it implements

- [What backs Activity, Emails and Files](../wayfinder/tickets/001-feed-data-sources.md) — Emails is
  the only feed that pages (`docinfo` carries `limit=21`, more by
  `frappe.desk.form.load.get_communications`, offset-style), and Files needs its own `File` query
  because `docinfo.attachments` carries no `creation`, `modified` or `owner`.
- [The tab contract](../wayfinder/tickets/004-tab-contract.md) — the `feeds` prop, and the day-one
  list being all real.
- [How a post reaches the feed](../wayfinder/tickets/007-composer-send-path.md) — the
  `attachment_logs` fan-out, which is still one socket handler.

## Prototype

- `src/pages/prototypes/generic/GenericTimeline.vue:82-96` — the email row: subject, recipients, and
  the bordered body block.
- `GenericTimeline.vue:75-80` — the comment row, for the shape a Files entry echoes.

## Framework surface

None.

## Traps

None specific to this slice.

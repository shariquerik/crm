# Slice 04 — `useDocinfo` and the header

**Leaves working:** the header is finished — assign someone, and the avatars update over the socket.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **Who owns what** and **Data** before
starting.

This slice proves the mutate-then-echo round trip that every later mutation uses, against a row of
avatars — a small enough surface to say plainly whether the subscription works.

## When it lands

The header shows the record's assignees as stacked avatars. Clicking them opens a menu that assigns
and unassigns, and the avatars update from the `docinfo_update` echo rather than from the mutation's
response. A second browser assigning someone updates the first without a refresh. Killing and
restoring the connection refetches `docinfo` and the avatars are correct again.

## Files

**Created:**

- `src/composables/useDocinfo.ts` — the eleven buckets read off the shared `getdoc` response, the
  `doc_subscribe` and `docinfo_update` handler, the reconnect refetch, and the assign mutation.
- `src/components/record/RecordAssignees.vue`

**Also edits:** `src/composables/useRecordPage.ts`, to compose and spread `useDocinfo(docResource)`;
`src/components/record/RecordHeader.vue`, to render `RecordAssignees`.

The prototype's `AvatarGroup.vue` and `PeopleControl.vue` collapse into one file: frappe-ui's
`Avatar` already stacks, and the two only split because one was mock chrome.

Only the **assign** mutation lands here. Tag, follow and share ship in slice 09 with the controls
that fire them.

## Decisions it implements

- [Who owns the doc and its dirty state](../wayfinder/tickets/002-doc-state-ownership.md) — where
  `docinfo` lives and why it never touches `isDirty` or `save`.
- [How a post reaches the feed](../wayfinder/tickets/007-composer-send-path.md) — the subscription's
  scope and ownership, the splice-by-`action` handler, and the reconnect refetch.
- [What backs Activity, Emails and Files](../wayfinder/tickets/001-feed-data-sources.md) — the
  buckets `getdoc` returns.

## Prototype

- `src/pages/prototypes/generic/PeopleControl.vue:3-41` — the popover trigger, the assignee list
  rows and the _Assign to..._ footer.
- `AvatarGroup.vue:3-13` — the overlap: `-ml-1.5` on every avatar after the first, with
  `ring-2 ring-surface-base`.

## Framework surface

None. This slice touches no layout renderer.

## Traps

- **`socket.off` must be passed the handler reference.** A bare `off('docinfo_update')` would kill
  every other listener on the page. Teardown also emits `doc_unsubscribe`.
- **Do not refetch on every event.** Today's CRM handler reloads everything on any `comments` event;
  the handler here splices by `action` after filtering on `doc.reference_doctype` and
  `doc.reference_name`. `frappe/public/js/frappe/form/form.js:2306` is the reference implementation.

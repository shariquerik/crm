# What a save actually costs

Research for [ticket 009](../wayfinder/tickets/009-save-endpoint-cost.md). This one **was
measured**, against a running site on this bench. Sources cited are `apps/frappe` (framework),
`apps/crm` (the python app) and `frontend2` itself.

## Short answer

All three claims in the ticket hold. `frappe.client.set_value` really does cost two requests and
three full document reads, it really cannot see a concurrent edit, and `savedocs` really does
return a `getdoc`-shaped response.

But the measurement turned up a fourth option the ticket did not list, and it beats both:
**`frappe.client.save(doc)`**. It is the same whole-document write as `savedocs` — same one full
read, same conflict detection — without `get_docinfo`, `run_onload`, `capture_doc` or the
`msgprint`. Measured at **24 SQL statements against `savedocs`' 33 and `set_value + getdoc`'s 45**,
and the fastest of the three at both document sizes.

Recommend `save()` calls `frappe.client.save`, sending back the whole record the page fetched with
the edits applied, and repaints from what comes back.

## How this was measured

Bench at `/Users/shariq/crm-bench`, site `crm.localhost`, served by `bench start`'s development
web server on port 8019, MariaDB on the same machine, logged in as Administrator over HTTP.

The doctype is **`CRM Deal`** — 75 fields and four child tables (`contacts`,
`status_change_log`, `products`, `rolling_responses`, all declared in
`crm/fcrm/doctype/crm_deal/crm_deal.json`). `Sales Order` was not available: this site's
`installed_apps` is `frappe`, `crm`, `gameplan`, with no ERPNext.

No existing Deal has a large child table — the largest `status_change_log` on the site is nine
rows — so two throwaway Deals were created, measured, and deleted. The site was left with the
same 42 Deals it started with.

| fixture | child rows | whole document as JSON |
| --- | --- | --- |
| SMALL | 0 products, 1 status log | 1187 bytes |
| BIG | 200 products, 1 status log | 90 565 bytes |

Wall times are the median of 35 timed iterations, after 10 discarded warm-up iterations, each
iteration writing one changed `Data` field. **Treat the times as indicative only** — a
single-process development server on a laptop, with the database local, so network latency is
zero and the per-request Python overhead is larger than it would be under gunicorn. The
request counts, the SQL counts and the byte counts are exact.

SQL counts come from frappe's own recorder (`frappe/recorder.py:325-380`), one representative
request per endpoint. They are deterministic and repeatable.

The in-process cost of individual functions was timed inside `bench console`, median of seven.

## Claim 1 — two requests and three full reads. **Confirmed, exactly.**

Counted from the recorder, `SELECT * FROM \`tabCRM Deal\` WHERE name = ...`:

| request | full document reads | SQL, SMALL | SQL, BIG |
| --- | --- | --- | --- |
| `frappe.client.set_value` | **2** | 29 | 229 |
| `frappe.client.get` (today's reload) | 1 | 7 | 7 |
| `frappe.desk.form.load.getdoc` (the reload after [ticket 001](../wayfinder/tickets/001-feed-data-sources.md)) | 1 | 16 | 16 |
| `frappe.desk.form.save.savedocs` | **1** | 33 | 233 |
| `frappe.client.save` | **1** | 24 | 224 |

The two reads inside `set_value` are exactly where the ticket said they were. `set_value` calls
`frappe.get_doc(doctype, name)` to have something to `update()` (`frappe/client.py:214-216`), and
then `doc.save()` (`client.py:223`) runs `check_if_latest` (`frappe/model/document.py:836`),
which calls `load_doc_before_save` (`document.py:1388`), which reads the document a second time
with `for_update=True` (`document.py:1868`). The recorder shows both, the second one as
`... FOR UPDATE`.

`savedocs` and `client.save` build the document from the request payload
(`frappe/desk/form/save.py:18`, `frappe/client.py:258`), so only the `FOR UPDATE` read happens.
The recorder confirms: one read, and it is the locking one.

So per save: **3 full reads over 2 requests, against 1 read in 1 request.** As claimed.

Two things that count matters less than the ticket assumed:

- **Child rows dominate everything at scale.** Both paths write child rows one at a time —
  200 `UPDATE \`tabCRM Products\`` statements on the BIG fixture, in `set_value` and in
  `savedocs` alike. At 200 rows the saved full read is 12 statements out of ~240. The saving is
  real at a small document and noise at a large one.
- **`set_value` returns the whole document anyway.** `client.py:225` is `return doc.as_dict()`.
  So the "cheap diff" path uploads 88 bytes and then downloads the entire document *twice* —
  once as the `set_value` response, once as the reload.

### Wall time and bytes

Today's code, `set_value` + `frappe.client.get` (`useDetailPage.ts:89,95`,
`resources.ts:33`), against `savedocs`:

| | requests | median | uploaded | downloaded |
| --- | --- | --- | --- | --- |
| SMALL, `set_value` + `client.get` | 2 | 26.7 ms | 146 B | 2 843 B |
| SMALL, `savedocs` | 1 | 37.2 ms | 1 911 B | 5 130 B |
| BIG, `set_value` + `client.get` | 2 | 51.1 ms | 146 B | **175 201 B** |
| BIG, `savedocs` | 1 | 46.5 ms | 100 089 B | 95 309 B |

The same comparison once the record resource moves to `getdoc`, which is the shape the page is
actually heading for:

| | requests | median | uploaded | downloaded |
| --- | --- | --- | --- | --- |
| SMALL, `set_value` + `getdoc` | 2 | 37.4 ms (19.2 + 17.1) | 143 B | 6 003 B |
| SMALL, `savedocs` | 1 | 30.6 ms | 1 915 B | 5 013 B |
| SMALL, `client.save` | 1 | **19.3 ms** | 1 891 B | **1 736 B** |
| BIG, `set_value` + `getdoc` | 2 | 55.8 ms (45.1 + 10.9) | 143 B | **178 324 B** |
| BIG, `savedocs` | 1 | 45.8 ms | 100 083 B | 95 182 B |
| BIG, `client.save` | 1 | **42.7 ms** | 100 069 B | 91 915 B |

Read those two tables together and the honest conclusion is not "`savedocs` is faster". It is:

- `savedocs` is **slower than today's code at a small document** (37.2 ms against 26.7 ms). It is
  not doing the same work — it also runs `get_docinfo`, which today's `client.get` reload does
  not. Compared like for like against `set_value + getdoc`, `savedocs` wins.
- The download is where the diff path loses, at every size, because `set_value` echoes the
  document back. On the BIG fixture the diff path moves **83 kB more** than `savedocs` does.
- The upload is where the whole-document paths lose, and it is the one cost that grows without
  bound: **88 bytes against 100 kB** on a 200-row child table. On a laptop against localhost that
  is free. On a real uplink it is the whole story — 100 kB at 1 Mbit up is roughly 800 ms, which
  swamps the ~50 ms round trip the whole-document path saves.

## Claim 2 — `set_value` cannot see a concurrent edit. **Confirmed, and proven both ways.**

The mechanism is in `set_user_and_timestamp` (`frappe/model/document.py:1047-1049`), which runs
at `document.py:834`, immediately before `check_if_latest` at `:836`:

```
self._original_modified = self.modified
self.modified = now()
```

`_original_modified` is simply whatever `modified` was on the in-memory document when the save
started. `check_if_latest` then compares it against the `modified` it just read back from the
database (`document.py:1399`).

- `set_value` built that in-memory document by reading the row a moment earlier
  (`client.py:215`), so `_original_modified` is by construction the current database value. The
  two always match. The check can never fire.
- Sending `modified` in the payload does not help. `set_value` strips every name in
  `frappe.model.default_fields` (`client.py:202-211`), and `modified` is one of them
  (`frappe/model/__init__.py:84-93`). In this bench that strip is silent rather than an error —
  commit `1a5cb379fe`, "don't reject whole-doc set_value over standard fields".
- `savedocs` and `client.save` build the document from the payload, so `modified` is the client's
  timestamp, and the check is meaningful.

Measured. One session read the Deal, a second session wrote a different field, then the first
session tried to save its stale copy:

| path | result |
| --- | --- |
| `set_value`, with the stale `modified` in the payload | **no error**, the write went through, last writer won |
| `savedocs` with the stale document | `TimestampMismatchError` |
| `client.save` with the stale document | `TimestampMismatchError` |

The message is `Error: CRM-DEAL-2026-00045 (CRM Deal) has been modified after you have opened it
(...). Please refresh to get the latest document.` `TimestampMismatchError` subclasses
`ValidationError` (`frappe/exceptions.py:168`), whose `http_status_code` is **409**
(`exceptions.py:58`).

frappe-ui surfaces it usably. `call()` puts `_server_messages` on the thrown error as
`e.messages` (`node_modules/frappe-ui/src/utils/call.ts:104`), and `errorMessage`
(`src/data/errors.ts:1-4`) joins them, so `saveError` would already show the framework's wording
today. It reads as a framework error, not a product one. Worth replacing.

## Claim 3 — `savedocs` returns a `getdoc`-shaped response. **Confirmed, with one real gap.**

`send_updated_docs` (`frappe/desk/form/save.py:88-97`) calls `get_docinfo(doc)` and appends the
saved document to `frappe.response.docs`. Measured against a `getdoc` of the same record:

| | `savedocs` | `getdoc` |
| --- | --- | --- |
| top-level keys | `docs`, `docinfo`, `_server_messages` | `docs`, `docinfo`, `_link_titles` |
| `docinfo` keys | 22 | 22, identical set |
| document fields | 60 | 30 |

So the `docinfo` is genuinely the same object — the page can repaint Activity, Emails and Files
from a save response and skip the reload. Two differences matter:

- **`savedocs` does not send `_link_titles`.** `getdoc` calls `set_link_titles(doc)`
  (`frappe/desk/form/load.py:54`), which writes `frappe.local.response["_link_titles"]`
  (`load.py:517-522`). `send_updated_docs` does not. The side panel wants those titles
  ([record-page-feeds.md](record-page-feeds.md)), so after a save the page has no fresh title for
  any Link field the user just changed.
- **The document is serialized differently, and the difference will bite the dirty check.**
  `getdoc` appends the `Document` object (`load.py:57`), which serializes through
  `BaseDocument.__json__` → `as_dict(no_nulls=True)` (`frappe/model/base_document.py:279-280`);
  `frappe.client.get` does the same explicitly (`client.py:116`). Null fields are **omitted**.
  `send_updated_docs` instead calls plain `doc.as_dict()` (`save.py:93`), and `client.save`
  returns plain `doc.as_dict()` (`client.py:261`) — nulls **included**. Measured on the SMALL
  fixture: 30 keys from `getdoc`, 60 keys from the save, the extra 30 all null.

  `fieldDiff` (`useDetailPage.ts:115-125`) compares `JSON.stringify(value)` against
  `JSON.stringify(stored?.[fieldname])`. `"null"` is not `undefined`, so repainting from a save
  response and then diffing against a `getdoc`-sourced record marks **thirty untouched fields as
  dirty**. Whichever endpoint `save()` calls, the page must normalize null and missing to the
  same thing before diffing.

`_server_messages` carries the `"Saved"` alert. frappe-ui's `call()` ignores it on success — it
returns the whole response when `data.docs` is present and never looks at `_server_messages`
(`call.ts:63`) — so it costs bytes and nothing else.

## What `savedocs` does that the page does not want

Timed in process, median of seven, on the BIG fixture:

| step | source | measured | verdict |
| --- | --- | --- | --- |
| `get_docinfo(doc)` | `save.py:91` | **6.2 ms**, ~9 SQL | the only one with a real cost |
| `capture_doc(doc, action)` | `save.py:19` | 0.00 ms | no-op here |
| `run_onload(doc)` | `save.py:46` | 0.00 ms | no-op for `CRM Deal` |
| `frappe.msgprint("Saved")` | `save.py:51` | 0.01 ms | free, but rides back in the response |
| `add_data_to_monitor` | `save.py:49` | not separable | negligible |

`capture_doc` is free because it returns immediately unless the site is under 15 days old
(`frappe/utils/telemetry/__init__.py:36-38` — this site is 6 days, so it does proceed) and then
gates on `is_pulse_enabled()`, which is `False` here (`telemetry/__init__.py:29-31`). **On a site
with telemetry enabled this becomes a network call on the save path.** That is the one that could
turn from free to expensive without warning.

`run_onload` is `doc.run_method("onload")` (`frappe/desk/form/load.py:409-411`). `CRM Deal`
defines no `onload`, so it is free — but it is per-doctype, and it is work done *after* the write
that the caller did not ask for.

So `savedocs` costs about 6 ms and 9 SQL more than a bare whole-document save, all of it
`get_docinfo`. That is worth paying only if the page needs fresh `docinfo` on every save. It does
not: `docinfo` changes when a comment or an email arrives, and frappe pushes those as
`docinfo_update` realtime events rather than expecting a refetch
([record-page-feeds.md](record-page-feeds.md)). Editing a field does not change `docinfo` except
for one `Version` row.

## Is `savedocs` safe on a doctype that is not submittable? **Yes. The risk is elsewhere.**

`savedocs` forces `doc.docstatus` from a map keyed on the action (`save.py:30-35`). With
`action = "Save"` that is `DocStatus.DRAFT`, which is `0`.

Measured: `CRM Deal` has `is_submittable = 0`, its `docstatus` is `0` before and `0` after, and
`savedocs` returned `docstatus: 0`. Forcing 0 on a document that is already 0 is a no-op.

`check_docstatus_transition` (`document.py:1410-1463`) confirms the general case. From
`docstatus = 0` to `docstatus = 0` it just sets `_action = "save"` (`document.py:1430-1431`).
A non-submittable doctype can never be in any other state.

The real hazard is the other direction, and it is worth knowing before the record page goes
generic: for a **submittable** doctype whose document is already submitted, sending
`action = "Save"` forces `docstatus` back to 0 and raises `DocstatusTransitionError` —
"Cannot change docstatus from 1 (Submitted) to 0 (Draft)" (`document.py:1455-1458`). A generic
`/:doctype/:id` that always sends `"Save"` will break on submitted documents. `frappe.client.save`
has no action map and no such hazard: it leaves `docstatus` at whatever the payload carries.

## The whole-document payload cannot be trimmed

Tested, because it is the failure mode that loses customer data rather than time. A payload built
from the fetched Deal, with the `products` child table and the `organization_name` field removed
before sending:

```
BEFORE  products=200  organization_name='Bench Fixture BIG'
AFTER   products=0    organization_name=None
```

Both writes succeeded. **Every child row was deleted and the omitted field was nulled.** This is
inherent to `frappe.get_doc(payload)` — the document is what the payload says it is, and
`db_update` writes every column.

That is not an argument against the whole-document path, but it is a hard constraint on it: the
page must send back **every field and every child row it received**, faithfully, plus the edits.
It cannot send a subset "to save bytes". Anything the page does not round-trip, it destroys.

## One environment observation, which belongs to neither endpoint

On this bench, **a document save that fails returns nothing over HTTP.** The request hangs
indefinitely — measured past 400 seconds — holding its `FOR UPDATE` lock, which then blocks every
later write to the same row.

It is not specific to `savedocs` or to conflicts. Reproduced with `savedocs` on a stale document,
with `savedocs` on a valid link failure, and with `frappe.client.set_value` on a valid link
failure. Errors raised *before* the locking read return normally and fast — a missing document is
a clean `404 DoesNotExistError` in under 0.1 s from all three endpoints. Errors raised *after* it
hang.

So this does not separate the candidates and should not influence the choice. It does mean the
409 conflict response could not be observed on the wire here; the conflict itself was proven in
process, inside `bench console`, where it raises immediately and correctly. It also means the web
process should be restarted after reading this — several of its threads are wedged.

## Recommendation

**`save()` should call `frappe.client.save({ doc })`** with the whole record the page fetched,
with the edits applied, and should repaint from the response instead of reloading.

Against `set_value` + `getdoc` this is one request instead of two, one full document read instead
of three, 24 SQL statements instead of 45, and it gains conflict detection. Against `savedocs` it
is the same write with the same conflict detection, without `get_docinfo`, `run_onload`,
`capture_doc`, the `"Saved"` message or the `docstatus` action map — measured at 19.3 ms against
32.3 ms, and 1 736 bytes back against 5 087.

Prefer `savedocs` over it in exactly one case: if the page turns out to need fresh `docinfo` on
every save. It should not, since `docinfo` arrives by realtime.

What the page has to handle as a result:

1. **Send the whole document, never a subset.** Trimming deletes child rows and nulls fields.
   This is measured, not theoretical. The page already holds the whole document, so this is a
   constraint on the payload, not new work.
2. **Normalize nulls before diffing.** The saved document comes back with explicit nulls, the
   fetched one comes back without them. Untouched, `fieldDiff` will call thirty fields dirty
   after every save.
3. **Handle `TimestampMismatchError`.** This is the point of the change. It arrives as HTTP 409
   with `exc_type: "TimestampMismatchError"`, already surfaced through `errorMessage` today, but
   in framework wording. It needs product wording and a way forward — reload and lose the edit,
   or reload and reapply it.
4. **Repaint from the response.** `frappe.client.save` returns the document as `message`, so
   frappe-ui's `call()` returns it directly (`call.ts:63` does not apply, since there is no
   `docs` key). No reload. That response is also the new baseline for the dirty check.
5. **Keep `_link_titles` from the last `getdoc`.** No save endpoint returns them. If the user
   changed a Link field, its title is stale until the next `getdoc`.
6. **Accept the upload.** Every save uploads the whole document — 1.9 kB for a plain Deal, 100 kB
   for one with 200 child rows. If that ever becomes the constraint, the fallback is `set_value`,
   and the price of falling back is one more round trip, two more full reads and the loss of
   conflict detection.

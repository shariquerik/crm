---
parent: ../map.md
labels: [wayfinder:research]
assignee: shariquerik
blocked_by: []
status: closed
---

# What a save actually costs, set_value against savedocs

## Question

[Who owns the doc and its dirty state](002-doc-state-ownership.md) settled that the record page
holds one doc and computes dirtiness as a diff against the fetched record. It did **not** settle
what `save()` calls. Source analysis pointed at `savedocs`, but the claim is worth measuring
before the build doc commits to it.

The two candidates:

- **`frappe.client.set_value(doctype, name, changes)`** — what `useDetailPage.ts:89` ships today,
  followed by `record.reload()`.
- **`frappe.desk.form.save.savedocs(doc, "Save")`** — the whole doc, desk's own path.

What source analysis claimed, each of which this ticket should confirm or refute by measurement:

- `set_value` costs **two requests and three full document reads** per save —
  `frappe.get_doc` in `client.py`, `load_doc_before_save` inside `check_if_latest`
  (`document.py:1388`), and the `getdoc` behind `record.reload()`. `savedocs` costs **one and
  one**, because it builds the doc from the payload.
- `set_value` **cannot** detect a concurrent edit. `check_if_latest` compares `previous.modified`
  to `_original_modified` (`document.py:1399`), and `set_value` re-read the doc a moment
  earlier, so they always match. `modified` is in `default_fields` and is stripped from the
  payload before the update.
- `savedocs` returns a **`getdoc`-shaped response** — `send_updated_docs` (`save.py:88-97`) calls
  `get_docinfo(doc)` and appends the saved doc to `frappe.response.docs` — so the page can
  repaint from the save response and skip the reload entirely.

Measure against a real doctype **with child tables**, since that is where the extra full reads
should hurt most and where the whole-doc payload is largest. `CRM Deal` or `Sales Order` will do.
Report wall time and payload size both ways, at a small doc and at a doc with a large child
table.

Also answer, because they bear on the decision and are cheap to check while there:

- How large the whole-doc upload actually gets, against the diff, for a realistic record.
- What `savedocs` does that the page does not want — `frappe.msgprint("Saved")`, `capture_doc`,
  `run_onload` — and what each costs.
- Whether `savedocs` is safe for a doctype that is not submittable, given it forces
  `doc.docstatus` from an action map.

## Read first

- `frappe/client.py`, `set_value`.
- `frappe/desk/form/save.py`, `savedocs` and `send_updated_docs`.
- `frappe/model/document.py`, `check_if_latest` and `load_doc_before_save`.
- `frontend2/src/composables/useDetailPage.ts:74-125` — the current save path.
- The resolution of [Who owns the doc and its dirty state](002-doc-state-ownership.md).

## How to resolve

`/research` subagent. Capture the findings in `docs/research/record-save-cost.md`, matching what
[What backs Activity, Emails and Files](001-feed-data-sources.md) did, and link it from the
resolution here.

If the numbers cannot be measured — no site, no data — say so plainly rather than presenting
source reasoning as measurement. Source reasoning is already in this ticket; repeating it is not
the deliverable.

## The answer must say

- The measured cost of both paths, or an explicit statement that measurement was not possible
  and why.
- Whether each of the three claims above holds.
- A recommendation for what `save()` calls, and what the page must handle as a result.

## Resolution

Measured on a live site against `CRM Deal` (75 fields, 4 child tables), with exact SQL counts
from frappe's recorder and throwaway fixtures at 0 and 200 child rows. Full findings in
[docs/research/record-save-cost.md](../../research/record-save-cost.md).

**`save()` calls `frappe.client.save({ doc })`** — neither of the two candidates the ticket
named. It is the same whole-document write with the same conflict detection as `savedocs`,
without `get_docinfo`, `run_onload`, `capture_doc`, the `"Saved"` msgprint or the `docstatus`
action map.

| | `set_value` + reload | `savedocs` | `client.save` |
| --- | --- | --- | --- |
| SQL statements | 45 | 33 | **24** |
| wall time | — | 32.3 ms | **19.3 ms** |
| bytes returned | 175 kB | 5.1 kB | **1.7 kB** |
| conflict detection | none | yes | yes |

Prefer `savedocs` in exactly one case: if the page turns out to need fresh `docinfo` on every
save. It should not — `docinfo` arrives by realtime.

### The three claims

All three hold, though the first matters less than it looked.

1. **Two requests and three full reads — confirmed exactly.** The recorder shows `set_value`
   issuing two `SELECT * FROM tabCRM Deal`, one plain and one `FOR UPDATE`, plus one more in the
   reload. But both paths write child rows one at a time, so on the 200-row fixture the saved
   read is 12 statements out of about 240. And `set_value` returns the whole document anyway
   (`client.py:225`), so the "cheap diff" path *downloads the document twice* — 175 kB against
   95 kB.
2. **`set_value` cannot see a concurrent edit — confirmed by source and by test.** A second
   session's write was silently clobbered. `savedocs` and `client.save` both raised
   `TimestampMismatchError` on the same setup.
3. **`savedocs` returns a `getdoc`-shaped response — confirmed, with one real gap.** `docinfo` is
   the same 22 keys. But `savedocs` sends no `_link_titles`, and it serializes the document with
   nulls included.

### Why desk uses `savedocs` and this page does not

`savedocs` is desk's *form controller*; `client.save` is the integration API. Desk needs the
docstatus action map (`save.js:26-30` sends Save / Submit / Update / Cancel), local-name
resolution so attachments made against an unsaved `new-crm-deal-…` document relink and the client
learns the real name (`save.js:112` reads `r.docs[0]`), a full `docinfo` to repaint the whole
screen in one response, `run_onload` for form scripts, and the `"Saved"` alert. The record page
needs none of those: it does not create records on this path, it gets `docinfo` by realtime, and
it renders its own toast.

**Submit and Cancel are not a reason to adopt `savedocs`.** `frappe.client` carries the whole
verb set — `insert` (`client.py:229`), `save` (252), `submit` (276), `cancel` (289), `delete`
(301) — and `client.submit` is the same shape as `client.save` with the same conflict detection,
since `submit()` routes through `save()` and therefore `check_if_latest`. Meanwhile `savedocs`
would cover only one of the two verbs: desk's Submit is an alias (`submit = savedocs`,
`save.py:115`), but its Cancel is a separate endpoint taking `doctype`/`name`. And `savedocs`'
action map makes the caller choose `"Save"` against `"Update"` from the document's current
docstatus, or take a `DocstatusTransitionError` — a mistake `client.save` cannot make, because it
reads `docstatus` off the round-tripped payload.

Two things genuinely would pull the page toward the desk endpoints, neither about `save`:

- **`queue_in_background`.** `savedocs` and desk's `cancel` hand submission to a worker for
  doctypes carrying that flag (`save.py:39-41`); `client.submit` always submits inline, which a
  heavy submittable can block on. Relevant if and when Submit lands, and only for flagged
  doctypes.
- **Attach-before-save on an unsaved record**, which needs the local-name round trip described
  above.

### What the page must handle

1. **Send the whole document, never a subset.** Measured, not theoretical: dropping `products`
   deleted all 200 rows, dropping a field nulled it. The page already holds the whole document.
2. **Normalize null and missing before diffing.** `getdoc` omits nulls via
   `as_dict(no_nulls=True)` (`base_document.py:279-280`); every save endpoint returns plain
   `as_dict()` with them. Measured at 30 keys against 60 on the small fixture. `fieldDiff`
   compares `JSON.stringify`, and `"null"` is not `undefined`, so an untouched dirty check marks
   **thirty fields dirty after every save**. This amends
   [Who owns the doc and its dirty state](002-doc-state-ownership.md).
3. **Repaint from the response, not a reload.** `client.save` returns the document as `message`,
   so frappe-ui's `call()` hands it back directly. That response is the new dirty-check baseline.
4. **Keep `_link_titles` from the last `getdoc`.** No save endpoint returns them, so a Link field
   the user just changed shows a stale title until the next `getdoc`.
5. **Handle `TimestampMismatchError`** — HTTP 409, `exc_type: "TimestampMismatchError"`. It
   reaches `errorMessage` today but in framework wording, and the user needs a way forward.
   Ticketed separately as
   [What a save does when the record moved underneath it](010-save-conflict-recovery.md).

### One environment finding, belonging to neither endpoint

A document save that **fails** hangs indefinitely over HTTP holding its `FOR UPDATE` lock.
Reproduced on `set_value` as well, so it did not affect the choice. It wedged several web-server
threads during this research; the web process was restarted.

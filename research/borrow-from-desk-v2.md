# What CRM's generic pages can borrow from desk v2

Question: frappe/crm#3634. Map: frappe/crm#3631.

Source: frappe `desk-v2` at `18ab622292`. Paths with no prefix are in `apps/frappe`. CRM paths are in `apps/crm` on `develop` at `83018d14d`.

Verdicts: **fits** (take as is), **fits with changes**, **does not fit**.

Facts below come from code and the desk v2 docs (`frontend/ARCHITECTURE.md`, `CONTEXT.md`, `SCRIPTING.md`, `LIST-SCRIPTS.md`). A line marked "inferred" is my reading, not a quote.

## Summary

| Area | Verdict | Take |
| --- | --- | --- |
| Address table and slug rule | Fits with changes | Slug rule, collision rule, build-once table. Not the full-bench table. |
| Generic routes | Fits with changes | One route table with `doctype` as a param; reserved words; static routes win. Not its URL shapes. |
| List defaults from meta | Fits | `in_list_view` columns, `sort_field`, fallback `name` + `modified`. |
| Settings tiers | Fits with changes | App, site, user merge key by key. CRM has no site tier and no app file. |
| Layout from meta | Fits | CRM already builds it (`get_default_layout`). |
| Side panel | Fits with changes | Draw nothing from fields when no Side Panel row exists. CRM needs a default. |
| Record tabs | Fits with changes | Built-in tab list plus doctype hooks. CRM activity is fixed to Lead and Deal. |
| Child tables | Fits with changes | Grid plus a row dialog from a child layout. |
| Save and conflict | Fits with changes | CRM has no stale check today; adding one needs a changed save path. |
| Submit, Cancel, Amend | Fits with changes | Rules and server calls port. The UI does not. |
| Workflow | Does not fit | Desk v2 has no record transition UI. Build from `get_transitions` and `apply_workflow`. |
| File scripts and Client Scripts | Does not fit | Different handler model. Extend `CRM Form Script`. |
| Replacement pages | Fits with changes | Keep the idea, drop the `pages.json` and per-app bundle. |
| Sidebar and permission filter | Fits with changes | One-pass readable-doctype set. Not its Rail/Sidebar doctypes. |

## 1. Address table, slug rule, generic routes

### How desk v2 does it

The slug is `frappe.scrub(name).replace("_", "-")`: `CRM Deal` is `crm-deal` (`frappe/shell/doctypes.py:15`). The slug is the address, not the identity: the router always moves toward the slug (`frontend/CONTEXT.md`, term Slug; `frontend/src/navigation/canonical.ts:7`).

The table is `{doctype: [slug, module_slug]}` over the whole bench, plus `modules`, `singles`, `submittables` and `unaddressed` (`frappe/shell/doctypes.py:64`). It skips child tables (`istable: 0`, line 27).

The table is the same for every user, so it leaves boot and is fetched with `GET`, keyed on `metadata_version`, cached for one year (`frappe/shell/doctypes.py:125-139`; `frontend/src/addresses.ts:90`). Server cache key: `shell_doctypes`, one key for owners and table (`doctypes.py:44`).

Two doctypes with one slug: the one created first keeps it, the later one has no address and a warning is logged (`doctypes.py:75`, `113`). The `unaddressed` list lets a link to the later doctype fail as not-found; before that, the link opened the older doctype (commit `898a5b92c2`).

New or renamed DocTypes are refused when the slug clashes with a page file or another row (`frappe/shell/address_clash.py:32`, `54`). During install, migrate and patch it logs instead of refusing (line 59). Commit `4ee2cbc70e`.

Reverse lookup uses `Object.hasOwn`, not a bare read, so `/constructor` does not resolve to a function (`frontend/src/addresses.ts:35`).

Routes are generated, with `doctype` as a param (`frontend/src/router/generated.ts:15-39`):

- `/:doctype` list.
- `/:doctype/view/list`, `/:doctype/view/:key` saved view.
- `/:doctype/new`.
- `/:doctype/:name`, `/:doctype/:name/record` (standard page).

There is no per-doctype route and no opt-out (`generated.ts:94`). App pages ("contributed routes") are listed before generated ones, so `/deals` beats `/:doctype` (`router/index.ts:42-43`).

Reserved words are handled in the table, not in the URL: a record named `new` has only its `standard-record` address (`router/routeFor.ts:67`); a record named `view` is reached through a redirect (`generated.ts:76-87`).

`routeFor(doctype, name, {view})` is the only way to build a doctype URL (`router/routeFor.ts:50-79`). It throws when the doctype has no address (line 95). A test, `TestNoHandBuiltDoctypeUrls`, fails on a hand-built path (commit `b654bd829e`).

A single has no list: its list address is its record (`router/index.ts:80-87`, commit `4cda0148f5`). A submittable never opens in the record dialog (`router/index.ts:89`).

### CRM v1 today

Routes are fixed per doctype in `frontend/src/router.js`: `/leads/view/:viewType?` with `alias: '/leads'`, `/leads/:leadId`, and a catch-all `/:invalidpath` (line 139). Mobile pages are picked in the route (`handleMobileView`, line 152).

The route name for a doctype comes from `get_route_name`, which adds an "s" (`crm/fcrm/doctype/crm_view_settings/crm_view_settings.py:333`). It is not a slug.

The view type is a path segment (`list`, `group_by`, `kanban`). A saved view is `?view=<name>` (`ViewControls.vue:479-502`). The view name is a database name, so it is already stable.

### Verdict

**Slug rule: fits.** Same rule, and it is a pure function. CRM could compute it on the client for display, but the table must still say which doctypes exist.

**Address table: fits with changes.** CRM needs only the doctypes in its sidebar, not the bench. Build the table from the sidebar rows plus `readable`, per user. The cache-by-version trick is lost, because the set depends on the user. Inferred: the table is small enough to ride the CRM boot payload that already carries `window.crm_setup_pending`.

**Generic routes: fits with changes.** Take the shape: one `/:doctype`, one `/:doctype/:name`, `doctype` as a param, static routes first. Do not take `/view/<key>` paths: CRM keeps `/view/:viewType?` and `?view=` (ruling: CRM keeps its formats).

**Collision rule: does not fit as is.** Desk v2 refuses a clashing DocType at creation. CRM has existing sites with doctypes already created. `/:doctype` would also meet CRM's own `/:invalidpath` catch-all and static names (`/calendar`, `/dashboard`, `/welcome`, `/setup`). Options for the grilling: a fixed prefix segment for generic pages, or static routes win and a clashing doctype opens through its prefixed URL only. Desk v2 chose "first created wins, later has none" and logs; CRM can take the same tie rule plus an explicit reserved list.

### Pieces to port

- The slug function and the first-created-wins tie rule (`doctypes.py:15`, `113`).
- A `routeFor` that throws on an unknown doctype, plus a test that forbids hand-built URLs (`routeFor.ts:95`).
- `Object.hasOwn` on the slug lookup (`addresses.ts:35`).
- Singles and submittables flagged in the table. Singles are out of scope for CRM (ruling 3), so skip them. Keep `submittable` for ruling 5.

### Pitfalls desk v2 hit

- A link to a slug-less doctype opened another doctype (`898a5b92c2`). Link to a missing address must be a miss, never a guess.
- A single's sidebar item asked for rows of a table that does not exist and died with a 500 (`4cda0148f5`). CRM excludes singles at the sidebar editor, and must also exclude them at the route.
- A module-less doctype crashed the canonical redirect (`03e17d191a`). Guard missing fields in the table.
- Record names that equal a route word (`new`, `view`, `record`) need an explicit rule (`router/routeFor.ts:63-67`, `generated.ts:76`).

## 2. List page: defaults from meta, settings tiers

### How desk v2 does it

Defaults live in `frontend/src/list/defaults.ts`:

- Columns come from meta fields with `in_list_view` and a column fieldtype. If there are none, the fallback is `name` and `modified` (`defaults.ts:25`, `129-132`).
- Sort comes from `sort_field` and `sort_order`, else `modified desc` (`defaults.ts:30-44`).
- Fetch fields are the columns plus what a cell reads beside its value: a Link's title, a Currency's currency, a title image, `_seen` on Track Seen doctypes (`defaults.ts:54-127`).
- Stored settings drop a fieldname that meta no longer has or the user cannot read (`list/storedSettings.ts:44`).

Settings have three tiers: app, site, user. The merge is key by key: `{...app, ...site, ...user}` (`list/useListSettings.ts:47-52`, `104-107`). Keys are `columns`, `sort`, `filters`, `quick_filter_fields` (`storedSettings.ts:28`).

The app tier is a `views/<type>.json` file in the app. Site and user tiers are rows of `Doctype View`, key `PLAIN_VIEW`, with `user` set to a site marker or the session user (`desk/doctype/doctype_view/api.py:217-244`). The read returns all three (`api.py:26`). `view_settings` returns one saved view and whether the caller can save it (`api.py:90`).

Writes patch keys and reset one key. They run under a row lock (`for_update`) and retry once on a unique-key race (`api.py:247-270`). The client debounces 500 ms and sends writes in a queue so a late reply cannot overwrite a later one (`useListSettings.ts:13`, entry `queue`).

A default view is a pointer per doctype, held at user, site or app layer. The first one that resolves wins; a pointer that no longer resolves is skipped (`desk/doctype/default_view/resolver.py:10`). The router redirects the bare list address to it (`router/index.ts:96-98`).

A plain view's filters stick per person in the user tier. A modified saved view is marked and written only on an explicit save (ARCHITECTURE.md, rows "Modified mark" and "Saved view settings").

### CRM v1 today

`crm.api.doc.get_data` builds the list read (`crm/api/doc.py:296`). Defaults come from the controller: `default_list_data()` on the doctype class (`doc.py:343-349`). Only CRM's own doctypes have it (`crm_lead.py:473`, `crm_deal.py:307`, `crm_organization.py:50`, `fcrm_note.py:32`, `crm_task.py:69`, `crm_call_log.py:64`).

When a doctype has no controller defaults, the columns are `name` and `modified` and the rows are `["name"]` (`doc.py:359-366`). Desk v2's fallback is the same.

`CRM View Settings` holds: `columns`, `rows`, `filters`, `order_by`, `group_by_*`, `kanban_*`, `user`, `public`, `pinned`, `is_standard`, `is_default`, `type`, `load_default_columns`. A per-user default view is the `is_standard = 1` row for `(dt, type, user)` (`doc.py:370-379`). A view with `user = ""` is shared (`api/views.py:6-15`). Quick filters are per doctype in `CRM Global Settings` (`doc.py:169-176`).

So CRM has two layers for the plain view (controller code, then the user's row) and no site row.

### Verdict

**Defaults from meta: fits.** Replace the missing-controller branch in `get_data` with a meta default: `in_list_view` columns first, `sort_field`, then the `name` + `modified` fallback. The fallback is already CRM's. This gives any doctype a usable list with no controller. The meta default stays below `default_list_data`, so built-in doctypes do not change.

**Cells beside the value: fits.** Link title, Currency currency, title image come from meta alone. Port the idea (`defaults.ts:85-127`), not the TypeScript. CRM does this on the server in `get_data` (`parse_list_data`), so the work is a Python rule over meta.

**Settings tiers: fits with changes.** Take the "missing key inherits from below" rule and the drop of unreadable fields. Do not add a site tier or a new doctype for it: CRM has `public` rows and `CRM Global Settings`. Inferred: a public `is_standard` row can play the site tier, and `default_list_data` plays the app tier. The grilling must decide whether a new tier is worth a migration. A settings write needs the lock-and-retry shape: CRM `create_or_update_standard_view` (`crm_view_settings.py:227`) has no row lock (inferred from the code at lines 227-300; I did not test a race).

**Default-view pointer and redirect: does not fit.** CRM uses `is_default` on the row and `?view=`. Keep it.

**Debounced queued writes: fits.** Cheap to copy, and it avoids the late-reply overwrite.

### Pieces to port

- `defaultColumns`, `defaultSort`, `fetchFields` logic as a Python meta default (`defaults.ts:32-74`).
- Drop-unreadable-fields on read (`storedSettings.ts:38-65`).
- Key-by-key merge across tiers (`useListSettings.ts:104-107`).
- Row lock plus retry on first write (`api.py:247-270`).
- The "workflow doctype: no bulk Edit and Delete unless List View Settings allow" rule (`defaults.ts:20`, SCRIPTING.md:465).

### Pitfalls desk v2 hit

- Permission checks per doctype were 3,594 ms against 25 ms for one pass (see section 5).
- A DocType change must mark cached list settings stale (ARCHITECTURE.md, "List settings": on `doctype_update` it keeps old rows on show and reads fresh ones).
- Two writes in flight can overwrite each other: use the queue.

## 3. Record page

### 3.1 Layout built from meta

Desk v2 reads `Form Layout` rows per doctype and type (Details, Side Panel, Quick Entry, row layout). The rule: first matching conditional row, else the row with no condition, else the meta layout (`frontend/src/recordPage/formLayoutSource/chooseLayout.ts:4`; `useFormLayout.ts:97`). The meta layout comes from the DocType's Tab, Section and Column breaks. `@framework/ui/FormLayout` has `buildLayoutFromMeta.ts` for this, and it is on `develop` too.

Fields a row does not place are "unplaced". They draw next to their `insert_after` anchor when they are new since the row was saved. The row lists `omitted` fields it knew about (`formLayoutSource/unplaced.ts`; CONTEXT.md terms Unplaced field, Omitted field, Anchor). Mandatory unplaced fields reach the user through a required-fields dialog on save (CONTEXT.md, Required-fields dialog).

Field access is applied at render: permlevel is a hard floor; at docstatus 1 only `allow_on_submit` fields stay editable; at 2 none (`formLayoutSource/fieldAccess.ts:24`).

CRM v1: `get_fields_layout(doctype, type)` reads `CRM Fields Layout`, and if there is none builds the default from meta breaks (`crm_fields_layout.py:30-48`, `219`). Types: Quick Entry, Side Panel, Data Fields, Grid Row, Required Fields (`crm_fields_layout.json`).

**Verdict: fits.** CRM already does "layout from meta". The extra pieces worth porting: unplaced and omitted fields (new custom fields appear after a layout is saved; CRM drops them silently, inferred from `get_fields_layout` keeping only fields named in the layout), and field access by docstatus. A new custom field on a generic doctype should show without an admin editing the layout.

### 3.2 Side panel

The panel is one list: built-ins `identity`, `quick_actions`, `people`, then the Side Panel layout's sections (`frontend/src/pages/record/panel/builtins.ts:8`; `panelEntries.ts`). With no Side Panel row the fallback is `"none"`, so fields are not drawn twice (`useFormLayout.ts:24`, doc comment). The panel resizes and collapses; width and open state live in the browser (CONTEXT.md, Panel, Disclosure).

CRM v1: `get_sidepanel_sections(doctype)` returns `[]` when no `Side Panel` row exists (`crm_fields_layout.py:116-120`). `SidePanelLayout.vue` takes a doctype.

**Verdict: fits with changes.** Same empty default. CRM needs a decision for a generic doctype: with no Side Panel row, the record page shows Details only, or the first section moves to the panel. Desk v2's answer is "no panel fields". The identity, quick-actions and people built-ins have no CRM equivalent for a generic doctype except assignees and the activity's own parts.

### 3.3 Tabs

Built-in tabs for every doctype: Details, Activity, Emails, Files (`pages/record/tabs/recordTabs.ts:26-50`). There is no doctype condition; a script hides what a doctype does not need. A script adds a tab with `page.tabs.add`. The address names the tab in `?tab=`.

CRM v1: Lead and Deal pages hold Activity, Emails, Comments, Data, Calls, Tasks, Notes, Attachments. The feed comes from `crm.api.activities.get_activities`, which accepts only a Deal or a Lead name (`crm/api/activities.py:16-23`). The map already lists this as "Generic activity backend".

**Verdict: fits with changes.** Take the closed built-in tab list plus an add/hide hook. The generic activity tab needs a generic backend. Desk v2 reads Frappe's own `docinfo` (versions, comments, communications, attachments) through `@framework/ui/ActivityTimeline` (`pages/record/feed/recordFeeds.ts`). `frappe.desk.form.load.get_docinfo` (`desk/form/load.py:118`) exists in v1 too, so a generic CRM feed can read it without a desk v2 API. Notes, tasks and calls are CRM doctypes and are linked by `reference_doctype`/`reference_docname` (inferred; check in the activity ticket).

### 3.4 Child tables

Desk v2 draws a `Table` field with the shared Grid. A child doctype's Details layout becomes a row dialog: opening a row shows the child's fields from its layout, with the row as `doc` for conditions (`formLayoutSource/joinLayout.ts` options `childMetas`, `childLayouts`; CONTEXT.md Row dialog). Without a child layout it draws every child field. Grid columns are the `in_list_view` fields either way. Scripts address a row by a handle that re-finds the row after a reorder (CONTEXT.md, Row handle).

CRM v1: `CRM Fields Layout` has a `Grid Row` type, and `get_fields_layout` takes `parent_doctype` for child permlevel handling (`crm_fields_layout.py:30`).

**Verdict: fits with changes.** The model matches CRM's `Grid Row` type. `@framework/ui` on `develop` already has `Grid` and `FormLayout`; check that the `Grid` exports match what the record page needs before a build ticket. Desk v2 wraps these with `@framework/ui/api` calls that do not exist on `develop` (section 6).

### 3.5 Save and conflict

Desk v2 sends the `modified` the user read with every save and with Submit and Cancel. The server compares it and raises `TimestampMismatchError` with `stale_doc` naming the record (`frappe/model/document.py:1788-1815`). The page then asks: reload and lose changes, or keep editing (`pages/record/saveResponse.ts:79-103`; `Record.vue:1017-1035`, `1057`). A conflict on another record, such as one linked in "Cancel all", names that record and offers to open it (`pages/record/staleRecord.ts`).

A background re-read merges server values into `saved` and keeps the fields the user touched. If the user touched a field the server also changed, `modified` stays old so the save will still conflict (`pages/record/refetchMerge.ts:9-24`). A child row's stamps (`modified`, `owner`) are not content (line 33).

Other save rules: Ctrl/Cmd+S, a browser prompt on unload with unsaved changes, required-fields dialog, field errors from the server marked on the field (`pages/record/recordSave.ts`; `saveResponse.ts`; `fieldErrors.ts`).

CRM v1: `useDocument` uses frappe-ui `createDocumentResource`, whose update URL is `frappe.client.set_value` (`frappe-ui/src/resources/documentResource.js:29`). `set_value` loads the document and applies the values; it takes no `modified` token. So a concurrent edit is overwritten (inferred from the call; I did not test two sessions).

**Verdict: fits with changes.** The behaviour is worth having on a generic record page, and the "draft versus saved plus merge on refetch" rule ports as a small pure function. It needs a save path that passes `modified`. Inferred: `frappe.client.save` with the full doc keeps the loaded `modified`, so the v1 `check_if_latest` raises `TimestampMismatchError`; the desk v2 `check_not_stale` and its `stale_doc` field are in the v2 API only (`document.py:1788`). Whether to add a CRM-side whitelisted method that takes `modified` is a one-way door (new whitelisted method) and the owner's call.

### 3.6 Submit, Cancel, Amend

Submit shows on a saved draft with no unsaved changes; Cancel sits in the `⋯` menu danger group on a submitted record. Both need their own right plus `write`, and neither shows on a doctype with a workflow (`pages/record/docstatusActs.ts:42-70`; SCRIPTING.md:977-983).

Submit asks to confirm. Cancel first lists submitted linked records (`frappe.desk.form.linked_with.get_submitted_linked_docs`) and offers "Cancel all" only when the user may cancel every linked doctype (`docstatusActs.ts:103-132`). The server call can be queued (`queue_submit`, `queue_cancel`) and the page waits for the reload (`docstatusActs.ts:170-196`). `modified` goes with the call, so a stale Submit conflicts (line 183).

Amend shows on a cancelled record whose doctype has `amended_from`, and becomes "Open amendment" when `frappe.client.is_document_amended` finds one. It opens a new record with `amended_from` set (`pages/record/amendAct.ts:12-37`).

Status badge: docstatus Draft, Submitted, Cancelled; or the workflow state coloured by its Workflow State style (`pages/record/recordStatus.ts:14-24`). The submittable flag is in the address table so the router never opens such a record in a dialog (`router/index.ts:89`).

CRM v1 has none of this; the only `docstatus` use is excluding it from group-by (`Deals.vue:32`, `Leads.vue:32`).

**Verdict: fits with changes.** Take the show/hide rules, the Cancel-all check and Amend lookup; they use v1 methods (`frappe.desk.form.linked_with`, `frappe.client.is_document_amended`, `frappe.client.submit` and `cancel`; inferred that these are on `develop`: the desk v2 file calls them by these names). Rewrite the UI in CRM components. Port `accessAtDocstatus` as well; without it a submitted record shows editable fields.

### 3.7 Workflow

Desk v2 record page does two things for a workflow doctype: the status badge shows the workflow state, and Submit and Cancel hide (`recordStatus.ts:14`, `docstatusActs.ts:46`). I found no per-record transition control in `frontend/src` or `ui/src`: the only transition code is the bulk bar (`pages/list/bulkStatus.ts`, `ui/src/api/index.ts:311`). Desk v2 docs list workflow as a gap for rows in list scripts (LIST-SCRIPTS.md:547-555).

CRM v1 has no use of Frappe Workflow; its "Workflow Automations" are its own feature.

**Verdict: does not fit.** Ruling 5 asks for the state and the allowed transitions on the record page. Desk v2 gives the state badge only. Build it on `frappe.model.workflow.get_transitions` and `apply_workflow`, both whitelisted in v1 and used by the desk v1 form (`frappe/model/workflow.py:74`, `152`; `public/js/frappe/form/workflow.js:30`, `137`). Port from desk v2: the badge colour from `workflow_state_styles` and the rule "workflow replaces Submit and Cancel". Also port `allow_bulk_edit` (`defaults.ts:20`) if the list gets bulk actions.

## 4. Page extension surface

### How desk v2 does it

One handler object per doctype and page. Keys are events (`onRefresh`, `onOpen`, `beforeSave`, `afterSave`, `beforeSubmit`, ... `onTabChange`) or fieldnames; a child field is `table.field` (CONTEXT.md, Handler; SCRIPTING.md:93-110). Every handler gets `page`, a curated read-only proxy; only `page.doc` and a row handle are writable (CONTEXT.md, Read-only view).

Customization is by surface: `quickActions`, `header`, `tabs`, `panelSections`, `frame`, `body`, `form`, plus `fields` and `form.tabs`. Verbs: `add`, `hide`, `show`, `update`, `move`, `has`, `order`, `clear` (CONTEXT.md, Surface). Every `onRefresh` is a replay: surfaces are cleared and rebuilt from built-ins, so a condition is a plain `if` with no undo (SCRIPTING.md:99-105).

The list page has four surfaces: `controls`, `columns`, `bulkActions`, `rowActions`, plus `page.view`, `rows`, `selection`, `filters`, `sort` (SCRIPTING.md:419-470). Columns take cell keys (`icons`, `badge`, `icon`, `format`, `switch`) as data or a function, with no extra chunk (ARCHITECTURE.md, `resolveCell`; `contributions/types.ts:19-28`).

Three tiers of source, in run order: file scripts the app ships (`<module>/doctype/<name>/frontend/record.js`, `list.js`), foreign-doctype file scripts (`custom/<name>/record.js`), then stored `Client Script` rows with `view = Record` or `List Page` (`contributions/types.ts:44-60`; `recordPage/scriptLoader.ts:1-50`). A script that fails to load is skipped whole; the rest run. Stored scripts compile as ES modules from a blob URL with an import map.

Replacement pages: `pages.json` beside the doctype names a page file for key `record`, `list` or a view type, optionally per app (`contributions/types.ts:62-76`; CONTEXT.md, Generated route). A replaced doctype keeps the standard page at `/<doctype>/<name>/record`. `{"record": "dialog"}` opts into the record dialog.

Doctype lookups are done at build time: a Vite plugin scans every installed app and emits virtual modules (`frontend/plugin/contributions.js`; `frappe/shell/manifest.py`). This is why files from other apps run on desk v2 at all.

### CRM v1 today

`CRM Form Script` rows with `view` Form or List (`crm_form_script.json`). The script text defines classes named after the doctype (`getClassNames`), instantiated with helpers (`createDialog`, `toast`, `call`, `router`, `formDialog`, `h`) and a doc proxy (`frontend/src/data/script.js:63-110`, `196-230`). Child doctypes are classes with the parent's name rule. A class exposes `actions`, `statuses`, `tabs` on the document (`script.js:182-185`). File scripts load by glob, `../doctypes/*/*.js` (`script.js:11`), only from CRM's own folder (`doctypes/crm_task/form.js`, `doctypes/fcrm_note/form.js`).

### Verdict

**Handler object, surfaces, `page` proxy: does not fit.** It is a different programming model, tied to desk v2's page engine, replay and `@framework/ui/api`. CRM's class scripts already exist and are in use. Rewriting them is a one-way door for every site with a Form Script.

**Extend the CRM class model instead: fits with changes.** `actions`, `statuses`, `tabs` on the document map to desk v2's header, status and tabs. What a generic record page needs and CRM lacks: hide a built-in, add a panel section, add a list column cell or row action, add a bulk action. Take the verbs `add`, `hide`, `update` from desk v2 as the shape of the additions, and its rule that a failed script is skipped and the rest still run (`scriptLoader.ts:12-28`).

**Replay model: fits with changes.** The rule "rebuild surfaces from built-ins on every refresh" is worth taking even without the full engine, because it removes undo logic. Inferred: CRM's `document.actions` array is already rebuilt per script setup.

**`list.js`, `List Page` Client Script: fits with changes.** CRM already has `view = List` on `CRM Form Script`, and `LIST-SCRIPTS.md` is a useful checklist of what v1 list scripts do (`get_indicator`, `add_fields`, `filters`, `formatters`, `primary_action`, bulk actions, row link target). For ticket 3635 and 3638, take the cell-key idea (data, not code, for badge, icon, format) because it needs no extra chunk.

**Per-doctype files from other apps: does not fit.** Desk v2 scans every app at build time. CRM is its own Vite app built from `apps/crm/frontend`; a doctype added by another app has no file in CRM's tree. For the first release, extensions come from `CRM Form Script` rows and CRM's own `doctypes/` folder. A manifest like `frappe/shell/manifest.py` is a build change and out of scope.

**Replacement pages: fits with changes.** Take the idea "a generic route opens the replacement page if one is declared, else the standard page", and "the standard page stays reachable at a second address". CRM's declaration would be a route table in code (the built-in pages, `Lead`, `Deal`), not a `pages.json`. This is how ruling 2 ("built-in pages move later") stays true: Lead, Deal and Contact keep their routes, and CRM Organization is the first doctype to give up its replacement page.

**Dialog opt-in: fits.** Useful for small doctypes and for Quick Entry (CONTEXT.md, Record dialog). Not for submittables.

### Pitfalls desk v2 hit

- A script on a foreign doctype runs in every app; gate on `page.app` (SCRIPTING.md:116-128). CRM scripts apply on `/crm` only, which is safer.
- Awaiting inside `onRefresh` made the page paint late; a limit of 500 ms and a `page.cached` read came from that (SCRIPTING.md:104-160).
- Records lost state when a script was saved while the page was open; stored scripts keep the old ones until all new ones compile (`ARCHITECTURE.md`, Script loader).
- Hiding by `when` that throws: an item whose condition throws hides on that row only (SCRIPTING.md:445).
- Handler keys share one flat keyspace of events and fieldnames, so a field named like an event clashes (CONTEXT.md, Handler).

## 5. Navigation and permission filtering

### How desk v2 does it

`boot.navigation` carries the rail and every sidebar, already merged from three layers (app, site, person) and permission-filtered on the server (CONTEXT.md, `boot.navigation`; `frappe/shell/navigation.py:68`). An item has a frozen `key`, one destination, no query of its own. Item types are code-owned `Navigation Item Type` rows. A type declares one of six permission buckets: Readable DocType, Module Contents, Derived From Children, Permitted Page, Always Visible, Custom (`frappe/shell/navigation_filter.py:14-20`; `desk/doctype/navigation_item_type/navigation_item_type.json`).

A `DocType` item is visible only if the user may read the doctype. The check is one set computed once: doctypes with a read DocPerm for the user's roles plus doctypes shared with the user (`frappe/shell/doctypes.py:142-151`). The filter says it is a courtesy, never a control: the document check at open time is the control (`navigation_filter.py:3-4`). A branch that holds nothing is dropped (`_cascade`, line 102).

An app with no `Rail` record gets a derived one: its own doctypes, readable and addressable, keyed by doctype name so the key survives a slug change (`navigation.py:599-614`). Landing resolves to the first item that resolves to a route (CONTEXT.md, Landing).

An item whose doctype has no address, or a type this version does not know, is dropped and reported (`navigation_filter.py:44-52`, `context.report_unfilterable`).

The sidebar editor is a desk v2 page (`frontend/src/navigation/editor/`), with fixes for moved rows, hidden rows and rows whose target the user lost (commits `57fe3705cc`, `f63e663ec6`, `613f308c9a`).

### CRM v1 today

`utils/navigation.js` is a fixed list of 10 items, filtered by `router.hasRoute(item.route)` and a `desktopOnly` flag (`frontend/src/utils/navigation.js:12-40`). It feeds the sidebar, the landing-page select and the command palette (`AppSidebar.vue:222`, `LandingPageSelect.vue:32`, `useCRMCommands.js:294`). There is no permission filter: a route exists or not.

### Verdict

**One-pass readable set: fits.** Take it as is: `frappe.permissions.get_doctypes_with_read` plus `frappe.share.get_shared_doctypes`. Per-doctype `has_permission` took 3,594 ms against 25 ms for 553 doctypes, and it imported every controller so one broken app broke every rail (commit `395f343c79`). The commit also says the sets differ only for Administrator, on doctypes no role can read. Ruling 3 ("a user sees a sidebar item only when they can read its doctype") maps to this call.

**Item as a keyed row with a destination: fits with changes.** For CRM a sidebar item is a built-in page or a doctype (map terms). Use a stable `key` per item (the doctype name, as in `_derive_rail`) so a rename or slug change does not break the user's order or hidden state.

**Layers (app, site, person): does not fit.** Out of scope for CRM's first release; the sidebar editor is "not yet specified" on the map. One admin-set list is the smallest step.

**Six permission buckets and item types as doctypes: does not fit.** Two kinds exist in CRM (page, doctype). A Python if is enough.

**The filter is a courtesy, never a control: fits.** The generic list and record must still check the permission on read. `frappe.get_list` and `frappe.get_doc` do. Say it in the build ticket so nobody adds a second check on the client.

**Cascade (drop an empty group):** not needed until CRM has groups.

### Pitfalls desk v2 hit

- Measured as Administrator, the per-doctype loop looked free (6 ms) and cost 3.6 s for a real user (`395f343c79`). Measure with a role that has no wildcard.
- A rail item whose target the user lost cannot be moved or open a sidebar (`57fe3705cc`).
- A sidebar item of the DocType kind for a single died with a 500 (`4cda0148f5`).

## 6. Things in desk v2 CRM v1 cannot take

- **`@framework/ui/api` and `@framework/ui/cache` are not on `frappe develop`.** `origin/develop` has no `ui/src/api` or `ui/src/cache` folder. Every desk v2 list and record file imports `@framework/ui/api`, which speaks `/api/v2` (`ui/src/api/envelope.ts` on `desk-v2`: `TimestampMismatchError` carries `stale_doc`). `useSession`, `usePagedList` and `useLinkSearch` are also desk-v2 only; `RichText` and `SectionMarks` have no folder on `develop`.
- **What `develop` does have** in `ui/src`: components `FormLayout`, `Grid`, `ActivityTimeline`, `ColumnSettings`, `Filter`, `SortBy`, `GroupBy`, `QuickFilter`, `ListView`, `Fields`, `Link`, `Composer`, `FileUpload`; composables `useDoctypeMeta`, `useDocPermissions`, `useUserRoles`. The named exports in `ui/package.json` are fewer, but `"./*"` maps to `./src/*`, so a deep import works (CRM already does this: `@framework/ui/components/GroupBy`). On `develop`, `useDoctypeMeta` calls frappe-ui `createResource` and `frappeRequest` (v1 style), not the v2 client.
- **The page engine** (`pageEngine/`, `recordPage/`, `listPage/`) is 9-layer, replay-based and imports `@framework/ui/api`. Not a drop-in.
- **`Doctype View`, `Default View`, `View Type`, `Form Layout`, `Rail`, `Sidebar`, `Navigation Item Type`** are desk v2 doctypes. CRM keeps `CRM View Settings` and `CRM Fields Layout`.
- **The desk v2 server calls** are decorated `@frappe.desk_v2_only` (`desk/doctype/doctype_view/api.py`, `frappe/shell/doctypes.py:125`). They do not run on `/crm`.

## 7. Port list

In order of value for the build tickets:

1. Meta defaults for the list (`in_list_view`, `sort_field`, fallback) as a Python rule under `default_list_data` (`defaults.ts:32-132`).
2. One-pass readable-doctype set for sidebar items (`doctypes.py:142-151`).
3. Slug rule, first-created-wins tie, reserved-word handling, `routeFor` that throws, and a test that forbids hand-built URLs.
4. Docstatus rules: show/hide, Cancel-all with linked records, Amend lookup, `accessAtDocstatus` (`docstatusActs.ts`, `amendAct.ts`, `fieldAccess.ts:24`).
5. Draft-versus-saved merge on refetch (`refetchMerge.ts`), conflict dialog wording (`saveResponse.ts:79-103`), and a `modified` token on save.
6. Unplaced and omitted fields for custom fields added after a layout was saved (`unplaced.ts`).
7. Cell keys as data for list columns (`contributions/types.ts:19-28`).
8. Key-by-key tier merge and lock-and-retry writes for settings (`useListSettings.ts:104`, `api.py:247`).
9. A closed built-in tab list with add and hide hooks (`recordTabs.ts:26`).
10. "A failed script is skipped, the rest run" (`scriptLoader.ts:12-28`).

## 8. Questions this leaves for the tickets

These are for the grillings on the map. This file does not decide them.

- URL shape: a prefix segment for generic pages, or `/:doctype`. Needed by the generic routes ticket.
- Whether CRM Organization keeps `/organizations` as a redirect or as an alias (ruling 2, migration path).
- A site tier for list settings: new row, or reuse a public `is_standard` row.
- A save path with a `modified` check: new whitelisted method (one-way door) or `frappe.client.save`.
- Generic activity backend: `get_docinfo` plus CRM's note, task and call doctypes.
- Default for the side panel on a doctype with no Side Panel row.
- Which `@framework/ui` pieces a build ticket must add on `frappe develop` (the list state, the draft-versus-saved record state; neither is in `ui/` on `develop`) and how to keep desk v2 and Helpdesk working.

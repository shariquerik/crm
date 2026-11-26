# What `@framework/ui` on `develop` offers the generic pages

Question: [frappe/crm#3633](https://github.com/frappe/crm/issues/3633). Map: [frappe/crm#3631](https://github.com/frappe/crm/issues/3631).

## Sources and method

- `develop`: `frappe/frappe` `origin/develop` at `3b6840c141`, folder `ui/` (`@framework/ui`). Paths below are relative to `ui/src/components/` unless noted.
- `desk-v2`: `origin/desk-v2`. Drift is `git diff origin/develop...origin/desk-v2 -- ui/src` (changes made on desk-v2 only). It is 2694 commits ahead and 958 behind `develop`.
- CRM: `frappe/crm` `origin/develop` at `83018d14d`, `frontend/src`.
- Helpdesk: the local checkout at `apps/helpdesk` (branch `flow-app-tools`), `desk/src`.
- Every claim comes from source files. No docs or blog posts.
- Other `ui/` docs worth reading: `ui/CONTEXT.md`, `ui/PHILOSOPHY.md`, `ui/docs/adr/` (ADR-0001 to ADR-0011), `ListView/USAGE.md`, `ActivityTimeline/DOCS.md`.

## Summary

- `develop` already has a doctype-agnostic, meta-driven list toolbar: `SortBy`, `Filter`, `QuickFilter`, `ColumnSettings`, `GroupBy`, joined by `useListView` and `useListData`.
- The controls were extracted from CRM, but CRM still runs its own copies of `SortBy`, `Filter`, `QuickFilter`, `ColumnSettings`, `Link`, `Grid`, `FieldLayout`, `Field`. CRM imports only `GroupBy`, `EmailItem`, `ConditionBuilder`, `DataImport`, `SetupFlow`, `Onboarding`, `EmailAccounts`, `socket`, `telemetry`, `island`.
- `develop` has no Kanban, no Submit, Cancel or Amend, no Workflow, no side panel, no saved views, no record page, no sidebar.
- The record side is `FormLayout` plus `Fields` plus `ActivityTimeline` plus `Composer`. It is controlled: the host loads, saves and routes.
- Every `develop` component calls `frappe.*` whitelisted methods (`getdoctype`, `search_link`, `client.get_list`, `get_activity_timeline`). None calls a `crm.*` method. All of them exist on Frappe 16 `develop`.
- `desk-v2` rewrites the data layer of the same components onto `/api/v2` through `ui/src/api/`. A later merge of `desk-v2` into `develop` changes how these components fetch.

## Backend that exists on Frappe 16 `develop`

- Checked in `frappe/` on `origin/develop`.
- `frappe.desk.form.load.getdoctype` (`desk/form/load.py:73`): meta with children and permissions.
- `frappe.desk.search.search_link` (`desk/search.py:66`): Link search.
- `frappe.client.get_list`, `frappe.client.get_count`: rows and totals.
- `frappe.desk.listview.get_assignee_groups` (`desk/listview.py:45`): Group By on `_assign`.
- `frappe.desk.form.activity.get_activity_timeline`, `get_more_email_activities`, `get_more_milestone_activities` (`desk/form/activity.py`).
- `frappe.handler.upload_file` (`handler.py:133`): file upload.
- `/api/v2` routes exist on `develop` (`frappe/api/v2.py`): `/document/<doctype>` (list, create), `/document/<doctype>/<name>` (read, update, delete), `/doctype/<doctype>/meta`, `/doctype/<doctype>/count`, `/method/<method>`, bulk routes, `/mcp`, `/discovery`.
- There is no `/api/v2` timeline route. `desk-v2` reads the timeline through the whitelisted method (commit `fddd9cc994`).

## Per component

### ListView module (`ListView/`)

- Purpose: state plus fetch for a list toolbar. It is not a table. `ListViewShell.vue` is a slot layout (`toolbar`, `table`, `footer`).
- `useListView(doctype)` returns `filters`, `sort`, `quickFilter`, `columns`, `groupBy`, `snapshot`, `restore`. `doctype` is by value; remount with `:key` to switch.
- `snapshot` is one JSON object of the whole view. The library never saves it (ADR-0007). The host watches it and persists it.
- `useListData(doctype, view)` returns `rows`, `loading`, `rowCount`, `totalCount`, `pageLength`, `loadMore`, `reload`.
- Backend: `frappe.client.get_list` plus `frappe.client.get_count` through `createListResource`. Exists on Frappe 16.
- Users today: no app. `useListView` and `useListData` appear only in `ListViewShell` stories and in desk-v2 (`frontend/src/list/useListView.ts`). CRM and Helpdesk do not import `@framework/ui/ListView`.
- Drift: desk-v2 changes `useListData` to `usePagedList` plus `countDocuments` from `@framework/ui/api` (`/api/v2` only), adds `countExact`, `countCapped`, `countTimedOut`. Same file keeps the same name.
- CRM's copy: `ViewControls.vue` (1890 lines) fetches through `crm.api.doc.get_data`, which also does views, Kanban columns, calendar and custom view rows. No equivalent of `get_data` view logic in `@framework/ui`.
- Mismatch: `useListData` sends filters as a list of `[fieldname, operator, value]` triples. CRM's `get_data` takes `filters: dict` and a CRM view object.

### List table (`experimental/List/`, subpath `@framework/ui/experimental/List`)

- Purpose: virtual-row table `List`, `ListFooter`, `ListBulkBar`. The API can change with no deprecation window.
- Props (`List`): `columns` (`ListColumn[]`), `rows`, `rowKey`, `loading`, `rowHeight`, `rowLink` (route per row), `gutter`.
- Events: `column-resize`, `column-reset`. Slots: `cell`, `empty`.
- Backend: none.
- Users: desk-v2 only (`frontend/src/list/defaults.ts`, `useListView.ts`, `storedSettings.ts`). Not used by CRM or Helpdesk.
- Drift: desk-v2 adds `useRowCursor`, key navigation, selection changes, footer changes (`+627 -44`).
- CRM's copy: CRM uses frappe-ui `ListView` through `ListViews/*ListView.vue` and `ListRows.vue`, with a hand-written cell renderer per doctype.
- Note: `ListColumn` is the `ColumnSettings` `Column` plus `align`. A `cell` slot is the only cell hook. `develop` has no fieldtype cell formatter (see Gaps).

### FormLayout (`FormLayout/`, subpath `@framework/ui/FormLayout`)

- Purpose: renders a `FormLayoutSchema` (tabs, sections, columns, fields). Evaluates `depends_on`, `mandatory_depends_on`, `read_only_depends_on`.
- Props: `layout`. Models: `v-model:doc` (required), `v-model:tab`. Event: `update:activeTab`.
- Schema hooks: per-field `ui` (component, props, `on`), per-field `override` (`hidden`, `readOnly`, `reqd`; ADR-0009), tab `override`, `ColumnPart` and section `part` (host components in the form).
- Builders: `buildLayoutFromMeta(fields, {childMetas, decorate})` builds the tree from doctype meta. `fieldsToLayout` builds from a flat field list. `resolveLayout` bakes conditionals.
- Backend: none for rendering. `useDoctypeMeta` fetches `getdoctype` (Exists). `resolveCurrency.ts` calls `frappe.client.get_value` and `frappe.meta.get_field_currency` for currency. `formatDefaults.ts` reads `frappe.defaults`/`sysdefaults`.
- Users: desk-v2 heavily (about 65 imports of `FormLayout`, 145 of `FormLayout/types`). CRM: none directly (its own `FieldLayout`). Helpdesk: none.
- Drift: large. desk-v2 adds `displayValue.ts` (read-only formatting by fieldtype), `linkFilters.ts`, `useFieldDisplay`, `FieldLabelAfter`, `emptyValue`, `gridColumnWidth` export, `noValueFields`, `+2340 -255` over 41 files.
- CRM's copy: `FieldLayout/{FieldLayout,Section,Column,Field}.vue` (about 960 lines). It takes CRM `tabs` from a `CRM Fields Layout` row. It reads `useDocument` for field property overrides and CRM Form Script. It has a `User` field, `Select` with option icons, a `preview` mode, `isGridRow`, `tabIndex`/`tabName` models.
- Compare: both render tabs, sections, columns. `FormLayout` takes a schema (`Tab[]`); CRM's layout JSON (tabs with sections, columns, fields, `name`) has the same tree shape. A converter from `CRM Fields Layout` JSON plus meta to `FormLayoutSchema` is the join point. `FormLayout` has `FieldOverride` as the equal of CRM's `fieldPropertyOverrides`.

### Fields (`Fields/`, subpath `@framework/ui/fields`)

- Purpose: one value-input per fieldtype plus a registry. `registerFieldType(fieldtype, component, {global})` and `getFieldComponent(fieldtype)`.
- Registered on `develop`: Link, Select, Check, Date, Datetime, Time, numeric types (Int, Float, Currency, Percent), text types, code types (lazy `CodeEditorField`), Phone, Heading, HTML, Password, Color, Autocomplete, Rating, Duration, Dynamic Link, Attach, Attach Image, Image, Geolocation, Button, Table, Table MultiSelect, Read Only. The fallback is `TextField`.
- Contract: `FieldComponentProps` and `FieldComponentEmits`. Context via `DocKey`, `ParentDocKey`, `UpdateKey`, `LinkTitlesKey`, `FieldErrorsKey`.
- Backend: Link and Table MultiSelect call `search_link` (Exists). Attach uses the FileUpload transport.
- Users: Filter and QuickFilter value inputs (ADR-0004). Helpdesk `BulkEditModal.vue` calls `getFieldComponent`. desk-v2 widely. CRM: none.
- Drift: desk-v2 adds 67 files (`+6816 -276`): rich text field, display components, picker fit, more fieldtypes. It also changes `Link` and `TableMultiSelect` fetching.
- CRM's copy: `Controls/*` (Link, Grid, AttachControl, ImageUploader, GeolocationControl, RatingInput, DurationInput, Password, HtmlControl, TextEditorControl, LinkMultiSelect, TableMultiselectInput, EmailMultiSelect) plus an if-chain in `FieldLayout/Field.vue`. CRM has `User`, `EmailMultiSelect` and `FormattedInput`. `@framework/ui` has no `User` fieldtype (Link to User covers it).

### Grid (`Grid/`, root export `Grid`)

- Purpose: editable table of rows for a child table. Props: `columns`, `disabled`, `cannotAddRows`, `cannotDeleteRows`, `label`, `description`, `error`, `required`, `cellError`, `newRow`, `parsePaste`. Model: rows. Slot: `cell`. Has paste, drag reorder, cell navigation, column resize.
- Backend: none.
- Users: the `Table` field in `Fields/TableField.vue`. CRM bundles it only for `@whatsapp/ui` `AccountForm` (see `frontend/vite.config.js` alias note). Helpdesk: none. desk-v2: through `TableField`.
- Drift: small (`+59 -27`, `Grid.vue`, `types.ts`).
- CRM's copy: `Controls/Grid.vue` (871 lines) plus `GridRowModal`, `GridRowFieldsModal`, `GridFieldsEditorModal`. CRM edits a row in a modal. `Grid` edits in place.

### Link (`Link/`, root export `Link`)

- Purpose: doctype Link picker over frappe-ui `Combobox`.
- Props: `doctype`, `filters`, `creatable`, `redirectable`, `editable`, `disabled`, `placeholder`, `title`, `idLabels`, plus label props. Events: `create(query)`, `redirect(value)`, `edit(value)`. Slots: `suffix`, `item-create`. Exposed: `reload`.
- Backend: `frappe.desk.search.search_link` (Exists).
- Users: Helpdesk (`TicketField.vue`, `UniInput.vue`, `Dashboard.vue`, `QuickFilterField.vue`, `ActionValue.vue`, `CFCondition.vue`, `SavedReplyActionChip.vue`), desk-v2, `Fields/LinkField.vue`. CRM: through `@whatsapp/ui` only.
- Drift: desk-v2 adds `RecordAnchor` (a real `href` with an `open` event), `useLinkSearch`, a fitted placeholder, search-cache age. It reads through `/api/v2`.
- CRM's copy: `Controls/Link.vue` (318 lines), also `search_link`, plus grouped options (a second `search_link` resource).
- Fit for ruling 7: `redirect` gives the host the value, so the host can route it to a generic page. `RecordAnchor` on desk-v2 gives a real link.

### Filter (`Filter/`, `@framework/ui/Filter`)

- Purpose: popover of fieldtype-aware conditions.
- Props: `doctype`. Model: `FilterCondition[]` (`fieldname`, `operator`, `value`, `field?`).
- Helpers: `getFilterableFields(fields, doctype)`, `getOperators`, `getDefaultOperator`, `getDefaultValue`, `serializeFilters` to triples, `parseFilters`.
- Backend: none. It is a port of `crm.api.doc.get_filterable_fields` over `useDoctypeMeta`. The server hook `restricted_fields` is not ported.
- Users: desk-v2 (`list/query.ts`, `storedSettings.ts`, `useListPage.ts`). Helpdesk and CRM: none (each has its own filter).
- Drift: small (`+124 -50`): lazy value inputs, `MultiLinkInput` via `useLinkSearch`.
- CRM's copy: `Filter.vue` (802 lines) plus `ConditionsFilter/filterableFields.ts`, which still calls `crm.api.doc.get_filterable_fields`. CRM serializes to a dict keyed by fieldname. `@framework/ui` serializes to triples (ADR-0003) so one field can hold two conditions.

### ConditionBuilder (`ConditionBuilder/`)

- Purpose: nested AND/OR condition tree. `fromFrappeConditions`, `toFrappeConditions`, `emptyTree`.
- Backend: none.
- Users: CRM (`Settings/WorkflowAutomations/WorkflowFilters.vue`), desk-v2 (DocType editor rules).
- Drift: `+2071 -95` (19 files; 9 new).
- Fit: a possible later upgrade for the filter popover. Not needed first.

### QuickFilter (`QuickFilter/`)

- Purpose: inline filter inputs in the toolbar, a projection over the same `FilterCondition[]` that `Filter` edits.
- Models: `filters`, `fields`, `customizing`. Event: `done`.
- Default fields: the doctype's `in_standard_filter` fields plus `name`.
- Backend: none. Port of `crm.api.doc.get_quick_filters` default branch. CRM's saved quick filters (`update_quick_filters`, global settings) are not ported. The host persists `view.quickFilter.fields`.
- Users: desk-v2 (`pages/list/ListPage.vue`). Helpdesk: none (own `QuickFilterField.vue` on `Link`). CRM: none.
- Drift: `+317 -17`, three new files.
- CRM's copy: `QuickFilterField.vue` plus a block inside `ViewControls.vue` (about line 1076 calls `get_quick_filters`).

### SortBy (`SortBy/`)

- Purpose: ordered sort rules. Props: `doctype`, `hideLabel`. Model: `Sort[]`. Helpers: `getSortOptions`, `serializeOrderBy`, `parseOrderBy`.
- Backend: none. Port of `crm.api.doc.sort_options` over meta.
- Users: desk-v2 (`list/query.ts`, `defaults.ts`, `storedSettings.ts`). CRM and Helpdesk: none.
- Drift: small (`+151 -9`).
- CRM's copy: `SortBy.vue` (278 lines), calls `crm.api.doc.sort_options`. CRM holds one sort. `@framework/ui` holds many.

### ColumnSettings (`ColumnSettings/`)

- Purpose: add, remove, reorder, rename, resize columns. Props: `doctype`, `hideLabel`, `canReset`. Model: `Column[]` (`fieldname`, `label`, `width?`). Event: `reset`.
- Helpers: `getDefaultColumns(fields, titleField)`, `serializeColumns`, `parseColumns`, `applyColumnWidth`, `clearColumnWidth`, `fetchFields`. Supports synthetic columns (ADR-0033) that name no docfield and that the host draws.
- Backend: none (meta only).
- Users: desk-v2 (`list/defaults.ts`, `useListView.ts`, `storedSettings.ts`). CRM and Helpdesk: none.
- Drift: `+239 -58`, plus `collabColumns.ts`.
- CRM's copy: `ColumnSettings.vue` (312 lines). CRM columns carry `key`, `label`, `type`, `width`, `align`. `@framework/ui` uses `fieldname`. CRM `get_data` needs its own column shape.

### GroupBy (`GroupBy/`, `@framework/ui/GroupBy`)

- Purpose: Group By summary. The grouped list shows one row per distinct group value with aggregates (`count`, `sum`, `avg`, `min`, `max`). It is not a list of records under group headings, and it is not Kanban.
- `GroupBy` props: `doctype`, `hideLabel`, `align`, excluded fields. Model: `GroupBySettings | null`. `GroupByTable` renders the rows. `useGroupByData(doctype, groupBy, filters)` fetches.
- Backend: `frappe.client.get_list` with `group_by`, plus `frappe.desk.listview.get_assignee_groups` for `_assign` (Exists).
- Users: CRM (`ViewControls.vue`, `GroupSummaryTable.vue`), Helpdesk (`ListViewBuilder.vue`, `composables/useGroupedList.ts`). desk-v2 frontend: none found.
- Drift: `+177 -138`. `useGroupByData` moves onto `/api/v2`.
- Fit: CRM's "Group by" view type in ruling 4 is "rows under headings". `GroupBy` here is the aggregate summary. CRM already uses it for its summary table. The headings view stays in CRM.

### ActivityTimeline (`ActivityTimeline/`, `@framework/ui/ActivityTimeline`)

- Purpose: renders a document's feed: emails, comments, assign and attachment logs, workflow and milestone logs, folded version changes. Slots `#item-{type}` for custom types.
- Props: `activities`, `loading`, `paginate`. `useActivityTimeline(doctype, docname, visibleTypes?)` returns `activities`, `loading`, `reload`, `paginate`. Subscribes to realtime `doc_update`. `addPendingActivity` shows an optimistic row.
- Exports: `CommentItem`, `EmailItem`, `LogItem`, `VersionItem`, `AttachmentChip`, `TimelineContainer`.
- Backend: `frappe.desk.form.activity.get_activity_timeline(doctype, name, visible_types)`, `get_more_email_activities`, `get_more_milestone_activities` (Exists on `develop`). Generic for any doctype. It reads Communication, Comment, Version, Activity Log.
- Users: CRM (`Activities/EmailArea.vue` uses `EmailItem` only; `Activities.vue` uses `@framework/ui/socket`). Helpdesk (`TicketTimeline.vue`, `TimelineCommentRow.vue`, `TicketAgent.vue`, `CommentTextEditor.vue`, `EmailEditor.vue`). desk-v2 (`pages/record/composer/*`).
- Drift: large (`+2635 -660`, 11 new files): `CommentEditor`, `MarkdownPreview`, `TimelineSkeleton`, `storeCache`, rewrite of `pendingRows`, `liveUpdates`, `pagination`. Commit `c7b23502a0` keeps the `develop` pagination API as deprecated, not removed.
- CRM's copy: `Activities/Activities.vue` (1082 lines) calls `crm.api.activities.get_activities`. That method knows Lead and Deal only (calls, notes, tasks, WhatsApp, status changes). Area components (`CommentArea`, `NoteArea`, `TaskArea`, `CallArea`, `EmailArea`, `AttachmentArea`, `EventArea`) draw each row.
- Fit: for a doctype with no CRM activity code, `get_activity_timeline` plus `useActivityTimeline` already returns a usable feed. Notes, tasks and calls are CRM doctypes; they need `custom` activity types.

### Composer (`Composer/`, root export)

- Purpose: `CommentComposer` (mentions) and `EmailComposer` (recipients, subject, quoted reply) on one tiptap editing core.
- Props: `placeholder`, `submitLabel`, `uploadFunction`, `extensions`, `maxAttachments`, `allowedFileTypes`, `submitting`, `mentions`, recipient search. Events: `submit(payload)`, `remove-attachment`. Slots `actions`, `attachments`.
- Backend: none. The host sends. Recipient lookup and upload are host functions.
- Users: Helpdesk uses its own `CommentTextEditor` and `EmailEditor` (they import `addPendingActivity`). desk-v2 (`pages/record/composer/CommentWriter.vue`, `EmailWriter.vue`). CRM: none.
- Drift: `+232 -82` (editor rewrite).
- CRM's copy: `CommentBox.vue`, `EmailEditor.vue`, `CommunicationArea.vue`.

### FileUpload (`FileUpload/`, `@framework/ui/FileUpload`)

- Purpose: upload dialog (device, camera, link, paste), queue engine `useUploader`, `AttachmentsList`, `UploadTray`, crop. Seam: `UploadTransport`; default `createFrappeTransport`.
- Props (`FileUploadDialog`): `open`, `multiple`, `imageOnly`, `crop`, `restrictions`, `transport`, `progressMode`, `folder`.
- Backend: `frappe.handler.upload_file` (`/api/method/upload_file`), chunked for large files (Exists). desk-v2 uploads through `api/upload.ts` to `/api/v2/method/upload_file`.
- Users: the `Attach`, `Attach Image`, `Image` fields. desk-v2 (`main.ts`, `useEmailDraft.ts`). CRM and Helpdesk: none directly.
- Drift: `+134 -210` (`useFileUpload` shrinks by about 200 lines).
- CRM's copy: `Controls/AttachControl.vue`, `ImageUploader.vue`, `Activities/AttachmentArea.vue`.

### TableMultiSelect (`TableMultiSelect/`, root export)

- Purpose: chips picker for a `Table MultiSelect` field. Props: `doctype`, `filters`, `placeholder`, `disabled`, `creatable`, label props. Event: `create(query)`.
- Backend: `search_link` (Exists). Reads and writes the child rows through the doc model, no own backend.
- Users: `Fields/TableMultiSelectField.vue`. desk-v2. CRM: none (own `TableMultiselectInput.vue`). Helpdesk: none.
- Drift: `+139 -57`, new `SelectedChip.vue`.

### Doctype meta and permissions (`composables/`)

- `useDoctypeMeta(doctype)` returns `meta`, `metas`, `loading`, `error`, `reload`. Memoised per doctype. Calls `frappe.desk.form.load.getdoctype` with `with_parent: 1` (Exists).
- `useDocPermissions(doctype, docinfo.permissions)` is a Vue port of `frappe.perm`: `can(right)`, `fieldAccess`. `useUserRoles` reads roles.
- Users: every control above. desk-v2 (about 71 imports).
- Drift: desk-v2 reads meta through `getMeta` (`/api/v2/doctype/<dt>/meta`) and adds `useSession`, `useLinkSearch`, `usePagedList`, `relativeTime`.
- Compare: CRM's `useDocument` and its `getMeta`-style stores keep their own copy. Meta read here is one getdoctype call per doctype per session.

### Others that matter

- `socket.ts`: `subscribeToDoc`, `getSocketInstance`. Used by CRM `Activities.vue` and the timeline.
- `Notifications/`: `NotificationPanel`, `useNotifications` (`frappe.desk.doctype.notification_log`). Used by Helpdesk. Fit for ruling 7 (notification links).
- `DataImport/`: used by CRM (`pages/DataImport.vue`, `LegacyDataImport.vue`). Works for any doctype. Candidate for a generic "Import" action.
- `Phone/`, `RichText/` (desk-v2 only), `SectionMarks/` (desk-v2 only).
- `mobile/` (`develop` only; removed on desk-v2): `Notifications`, `Profile`, `Search`. Not list or record pages.

## Who breaks if a component changes

- CRM imports: `GroupBy`, `ActivityTimeline` (`EmailItem`), `ConditionBuilder`, `DataImport`, `SetupFlow`, `Onboarding`, `EmailAccounts`, `socket`, `telemetry`, `island`, and `Link` plus `Grid` through `@whatsapp/ui`.
- Helpdesk imports: root (`Link`, `useOnboarding`, `NotificationLog`, `NotificationPanel`, telemetry), `ActivityTimeline`, `GroupBy`, `EmailAccounts`, `fields` (`getFieldComponent`).
- desk-v2 imports almost every component. Its `ui/` is a superset on a diverged branch: it deletes and rewrites parts the others use.
- Rule from commit `c7b23502a0`: deprecate, never remove, what an app built on `develop` imports. Follow it for any `@framework/ui` PR.
- The `./*` export (`"./*": "./src/*"`) lets a deep import reach any file. A rename inside `ui/src` can break a deep import in CRM or Helpdesk.

## desk-v2 drift in one view

- desk-v2 only (not on `develop`): `ui/src/api/` (13 files, the `/api/v2` client), `ui/src/cache/` (20 files, a record and list cache), `useSession`, `useLinkSearch`, `usePagedList`, `RichText`, `SectionMarks`, `displayValue`, `RecordAnchor`, `useRowCursor`.
- Components whose fetch path changes: `useDoctypeMeta`, `useListData`, `GroupBy` (`useGroupByData`), `Link` (`useLinkSearch`), `FileUpload` (`api/upload`), `ActivityTimeline` (`api`).
- Components whose API stays close: `SortBy`, `QuickFilter`, `Filter`, `ColumnSettings`, `Grid`, `TableMultiSelect` (all under +330 lines).
- Components that drift most: `Fields` (+6816), `ActivityTimeline` (+2635), `FormLayout` (+2340), `ConditionBuilder` (+2071).
- `develop` only: `AutomationBuilder` (35 files), `mobile/` (12 files), SetupFlow additions.
- `+n -m` counts are lines changed on desk-v2 since the merge base `2b9a3477e3`.

## Gaps for the generic pages

- **No page layer.** No generic list page, record page, sidebar, route or saved-view store. Only parts. CRM owns these, and `CRM View Settings`.
- **Wire shape mismatch.** `@framework/ui` filters are triples and `order_by` strings. CRM `get_data` takes a filter dict and a view object. The list needs an adapter, or `get_data` needs a triples path.
- **No Kanban.** Ruling 4 needs it. `develop` has none. CRM has `kanban_columns` and `kanban_fields` in `get_data`.
- **`GroupBy` is a summary, not headings.** CRM's "group by" view (records under headings) has no `@framework/ui` part.
- **No fieldtype cell renderer for the list.** `List` gives a `cell` slot only. A formatter by fieldtype (Link title, Currency, Date, Check, Select badge, Rating, Attach) exists only on desk-v2 (`FormLayout/displayValue.ts`). CRM has per-doctype cell code in `ListViews/*ListView.vue`.
- **No Submit, Cancel, Amend or Workflow.** Ruling 5 needs docstatus, status indicator, workflow state and allowed transitions (`frappe.model.workflow` methods). Nothing on `develop` calls them. `ActivityTimeline` only draws workflow log rows.
- **No record load, save or title bar.** `FormLayout` is controlled by `v-model:doc`. The host loads (`getdoc` or `/api/v2` read), saves, handles timestamp conflicts, dirty state, permissions banner.
- **No side panel layout.** `PanelLayout` exists on desk-v2 only, in `frontend/` and not in `ui/`. CRM has `SidePanelLayout` and `DataFields`.
- **No document sidebar items.** Assign to, tags, share, attachments panel, follow, like, linked docs, comment count. Only `AttachmentsList`, `Link` and the timeline logs exist. CRM has its own (`AssignTo`, `get_linked_docs_of_document`).
- **No generic notes, tasks, calls on the timeline.** `get_activity_timeline` reads Frappe core doctypes only. CRM notes, tasks, calls need `#item-{type}` slots and a CRM method.
- **Restricted fields not ported.** The `restricted_fields` controller hook in `get_filterable_fields` has no client equivalent. A doctype that hides fields from filters would show them.
- **Saved quick filters and views.** `useListView.snapshot` is only the contract. Persisting to `CRM View Settings`, pinned and public views, and default view, is host work.
- **`CRM Fields Layout` and `CRM Form Script`.** `FormLayout` has no converter from `CRM Fields Layout` JSON and no scripting hook except `FieldUI.on`. A `FieldOverride` plus `decorate` can carry a form script's effects.
- **Quick Entry.** No create dialog or new-record page. `FormLayout` plus `buildLayoutFromMeta` can draw one, but required-field choice (`reqd`, `allow_in_quick_entry`) is the host's.
- **`User` fieldtype.** CRM `Field.vue` has a `User` branch with avatars. Use `Link` to `User` instead, or register `User` with `registerFieldType`.
- **Realtime for lists.** `subscribeToDoc` is per document. No list-level update hook.
- **Permissions.** `useDocPermissions` is display only and fails open while loading. Server `get_list` filters by permission. `getdoctype` omits no doctype, so the sidebar's "user can read this doctype" check needs `frappe.has_permission` or the `/api/v2` read.
- **Excluded doctypes.** No helper to reject singles, child tables and virtual doctypes. `getdoctype` meta carries `issingle`, `istable`, `is_virtual`; the sidebar editor must filter on them.
- **Mobile.** `List` and `FormLayout` use fixed grid tracks. No phone layout. `develop` `mobile/` holds three unrelated screens, and desk-v2 removed it.

## Recommended reuse

- **Reuse now, no change:** `Fields` plus `FormLayout` (`buildLayoutFromMeta`, `FieldOverride`, `decorate`) for the record body; `Link` (`redirect` event) and `TableMultiSelect`; `Grid` through `TableField`; `ActivityTimeline` plus `useActivityTimeline` for a generic feed; `Composer` and `FileUpload` for write and attach; `useDoctypeMeta` and `useDocPermissions`.
- **Reuse with an adapter:** `useListView` state plus the five toolbar controls for the generic list. The adapter turns the triples and `order_by` into `get_data` arguments, or the generic list calls `frappe.client.get_list` and `get_count` through `useListData`. Pick one in the list-data ticket.
- **Keep CRM's own:** `Activities.vue` for Lead and Deal (until a later map); `FieldLayout/Field.vue` for the built-in pages (they still need CRM Form Script); `ViewControls.vue`; Kanban; `CRM View Settings`. Do not rewrite them in this map (ruling 2).
- **Build in CRM first, move to `@framework/ui` later:** list page shell, record page shell, sidebar, Submit and Workflow bar, side panel, cell formatter. Any of these that desk v2 could share goes to `@framework/ui` only after the shape settles. A new export is a one-way door (map rule).
- **Coordinate with desk-v2:** the cell formatter (`displayValue.ts`), `RecordAnchor` and `PanelLayout` already exist there. Land them on `develop` through the desk v2 map rather than build a second copy.
- **Fetch path:** CRM v1 calls `whitelisted` methods. Keep it that way. desk-v2 swaps the same components to `/api/v2` when it merges, so a CRM page built on `useDoctypeMeta` and `useListData` keeps working only if the merge keeps those return shapes. Pin this with a test in CRM.
- **Order of reuse for the first build:** (1) `useDoctypeMeta` plus `buildLayoutFromMeta` plus `FormLayout` on the record page; (2) `useListView` plus `SortBy`, `Filter`, `QuickFilter`, `ColumnSettings` on the list page; (3) `ActivityTimeline` on the record page; (4) `Composer` and `FileUpload` after the record page works.

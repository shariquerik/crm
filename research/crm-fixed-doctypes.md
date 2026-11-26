# What CRM v1 assumes about its fixed doctypes

Ticket: frappe/crm#3632 (map #3631).
Base: `frappe/crm` `develop` at 83018d14d.
Paths are relative to `frontend/src/` for the frontend and to `crm/` for the backend.
Verdicts: **nothing** = already works for a generic doctype. **fallback** = works with a default when the doctype has no special case. **change** = code must change or a new generic piece must exist.
A "generic doctype" is any doctype an admin adds to the sidebar (ruling 3: no singles, child tables or virtual doctypes).

## Summary of the shape

The data layer is mostly doctype-agnostic: `get_data`, `get_fields_layout`, `CRM View Settings`, `useDocument`, `getMeta`, `ViewControls`, `FieldLayout`, `DoctypeModal`, `CreateDocumentModal`.
The fixed parts are: the route table (one named route per doctype), route names used as keys everywhere (`route_name`, default views, sidebar keys, recent records, notifications), per-doctype list and record pages, and the activity backend (`get_activities`, notifications, mentions, comment hooks, command palette search, all Lead and Deal only).
Route name is the join key between a saved view and a page. A single generic list route breaks that join, because every generic doctype would share one route name.

## 1. Router and pages

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `router.js:29-137` | Static route table: one list route and one record route per built-in doctype, names `Leads`/`Lead`, `Deals`/`Deal`, `Contacts`/`Contact`, `Organizations`/`Organization`, `Notes`, `Tasks`, `Call Logs`, `Data Imports`. | change | Add generic routes (list, record). Keep the old ones untouched. |
| `router.js:37-42` and siblings | List routes use `path: '/leads/view/:viewType?'` plus `alias: '/leads'`. Record routes use `/leads/:leadId` with `props: true`. Param name is derived per doctype (`leadId`, `dealId`, `contactId`, `organizationId`). | change | Generic record route needs one param (doctype + name). Do not reuse the `${name}Id` convention. |
| `router.js:139-143` | Catch-all `/:invalidpath` matches one path segment only. | nothing | A generic route with two or more segments (`/d/:doctype/...`) never collides. A one-segment slug route would. |
| `router.js:150-154` | `handleMobileView` picks `Mobile<Name>.vue` at navigation time, below 768 px. | change | Ruling 6: generic pages are one responsive layout. No `Mobile*.vue`. The check is not reactive to resize. |
| `router.js:156-162` | `mobileHomeRoute` falls back to `{ name: 'Leads' }` when no default view exists. | fallback | Fine for existing sites. A default view on a generic doctype must resolve to a generic route (see `viewRoute`). |
| `router.js:164-171` | `landingPageRoute` turns the stored landing page (a route name or a view name) into a route with `router.hasRoute`. | change | A generic doctype has no route name of its own. The landing page value needs a doctype-aware form. |
| `router.js:174` | `createWebHistory('/crm')`. | nothing | Generic routes live under `/crm` too. |
| `router.js:212-213` | Unknown path goes to `Invalid Page`. | nothing | A generic route for an unreadable or missing doctype must show its own not-found or not-permitted state. |
| `router.js:214-218` | For `Deal` and `Lead` only, a missing hash becomes `#<lastTab>` from `localStorage` keys `lastDealTab` and `lastLeadTab`. | change | Generic record page needs a per-doctype tab key (for example `lastTab:<doctype>`). |
| `router.js:219-228` | The default-view redirect runs for a hard-coded list of nine route names. | change | The generic list route must join this redirect, or do the same job itself. |
| `router.js:239-248` | `doctypeMap` maps list route name to doctype (`Leads` to `CRM Lead`, ...). | change | The generic route gets the doctype from its param. Replace the map lookup with the param. |
| `router.js:253-262` | `getDefaultView(to.name)` looks up a global default view by route name. | change | Key by doctype for generic pages (see `stores/views.js`). |
| `router.js:266-271` | Standard default type is read from `standardViews[doctype + ' ' + viewType]`. | nothing | Keyed by `dt`, so it already works for any doctype. |
| `router.js:280-297` | A non-standard `:viewType` param is resolved by `name` or `label` in `views.data`, with no `dt` filter. | change | `views.data` holds all of the user's views. Two doctypes with a view of the same label collide. Filter by doctype. |
| `App.vue:3-6` | Renders by `$route.name` (`Not Permitted`, `Setup`) and `session.isLoggedIn && $route.name`. | nothing | A generic route needs a name, or the layout does not render. |
| `components/Layouts/layouts.js:11-13` | Shell is `mobile` below 640 px, `desktop` otherwise. | fallback | The shell breakpoint (640) differs from `isMobileView` (768 in `router.js:150` and `composables/settings.js:26`). Pick one for the generic pages. |
| `pages/Leads.vue`, `Deals.vue`, `Contacts.vue`, `Organizations.vue`, `Notes.vue`, `Tasks.vue`, `CallLogs.vue`, `DataImports.vue` | One hand-built list page per doctype. Each hard-codes `doctype=` on `ViewControls`, a `getMeta('<doctype>')`, a row mapper, an empty state and a create modal. | change | These are the pages the generic list page replaces for new doctypes. Organization moves first (`pages/Organizations.vue`, 165 lines, simplest). |
| `pages/Lead.vue`, `Deal.vue`, `Contact.vue`, `Organization.vue` and the four `Mobile*.vue` | One hand-built record page per doctype: header, side panel, tabs, activities. | change | Same. `pages/Organization.vue` (665 lines) is the proof case. |
| `pages/Home.vue`, `Dashboard.vue`, `Calendar.vue`, `Welcome.vue`, `Setup.vue` | Built-in pages that are not doctypes. | nothing | Stay as sidebar items of kind "built-in page". |
| `components/ListViews/*ListView.vue` (`LeadsListView.vue:8`, `DealsListView.vue:8`, `ContactsListView.vue:8`, `OrganizationsListView.vue:6`) | `getRowRoute` returns `{ name: 'Lead' | 'Deal' | ... , params: { leadId: row.name }, query: { view, viewType } }`. | change | Generic list view needs a generic row route. Keep passing `view` and `viewType` in the query, the record page reads them for breadcrumbs. |
| `components/ListViews/ListRows.vue:63,79,83` | `doctype` prop defaults to `CRM Lead`. Scroll position key and "seen" check use the prop. | nothing | Must be passed explicitly. The `CRM Lead` default is a trap. |
| `components/Kanban/KanbanView.vue:89-90` | Card link is `options.getRoute(fields)`, supplied by each page. | nothing | Generic page supplies its own `getRoute`. |
| `components/Kanban/KanbanActivityCounts.vue:30-60` | Pushes `{ ...props.route, hash: '#' + tab }` on click. | fallback | Works if the generic record page has the same tab names (`emails`, `comments`, `tasks`, `notes`). Counts come from `set_activity_counts` (section 12). |
| `components/ViewBreadcrumbs.vue:3-12,71` | `routeName` prop is both the link target (`{ name: routeName }`) and the label (`__(routeName)`). | change | Generic list needs a label from the doctype or sidebar item, and a link that carries the doctype param. |
| Record page breadcrumbs (`pages/Lead.vue:408-432`, same in `Deal.vue:534`, `Organization.vue:315`, `Contact.vue:256` and the Mobile pages) | Build `[ListName, savedView?, record]`. They call `getView(route.query.view, route.query.viewType, '<doctype>')`. | change | Generic record page does this from the doctype param. |
| `pages/Lead.vue:330`, `useDocument('CRM Lead', props.leadId)` (and the same pattern in each record page) | Record pages call `getMeta`, `useDocument`, `useVisitedRecords` with a literal doctype. | nothing | These APIs take any doctype. Pass the param. |
| `data/document.js:53` `useDocument` | Loads via `createDocumentResource`, caches by doctype and name, loads form scripts and permissions (`frappe.client.get_doc_permissions`). | nothing | Generic. No `docstatus`, submit, cancel, amend or workflow code exists anywhere in `frontend/src` (ruling 5 is all new). |
| `composables/useActiveTabManager.js:5-8` | Last visited tab is stored under a caller-supplied key. | nothing | Pass a per-doctype key. |
| `components/FieldLayout/Field.vue:554` | Special case `doctype === 'CRM Task' && fieldname === 'priority'`. | nothing | Only fires for CRM Task. |
| `utils/fieldTransforms.js:194-214` | `applyContactOrganizationGrouping` only for `CRM Deal` and field `contact`. Used in `SidePanelLayout.vue:559` and `FieldLayout/Field.vue`. | nothing | No-op for others. |

## 2. Sidebar and navigation

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `utils/navigation.js:13-34` | `navigationItems`: a static list of `{ label, icon, route }`. The `route` is a route name. | change | Needs a second kind of item: a doctype item built from admin config. Items must keep `route`-name items for existing sites. |
| `utils/navigation.js:36-40` | `getNavigationItems` filters by `router.hasRoute(item.route)` and `desktopOnly`. | change | There is no read-permission filter. Ruling 3 needs "user can read the doctype". The boot has no permission data (`www/crm.py:73-100`), so an API is needed. |
| `components/Layouts/AppSidebar.vue:222` | `const links = getNavigationItems(...)` runs once at setup, not reactive. | change | A sidebar built from admin config must be reactive (add, reorder, hide without reload). |
| `components/Layouts/AppSidebar.vue:225-240` | Builds the "All Views" group: `key: link.route`, `to: { name: link.route }`. | change | Generic item needs `to` with the doctype param and a key that includes the doctype. |
| `components/Layouts/AppSidebar.vue:257-270` | Pinned and public views become links with `to: { name: view.route_name, params: { viewType }, query: { view } }`. | change | `route_name` of a generic saved view is not a route name. See section 3. |
| `components/Layouts/AppSidebar.vue:272-290` | `getIcon(routeName, icon)`: a `switch` on route names (`Leads`, `Deals`, `Contacts`, `Organizations`, `Notes`, `Call Logs`), default `PinIcon`. `Tasks` and `Calendar` are missing and fall to `PinIcon`. | change | Generic items need an icon from config, with a doctype icon fallback (`IconPicker.vue` exists). |
| `components/Layouts/AppSidebar.vue:294-304,323` | Active item key is `route.query.view || route.name`. | change | Two generic doctypes share one route name, so `route.name` cannot tell them apart. Use the doctype param. |
| `components/Layouts/AppSidebar.vue:222,52` and `MobileLayout.vue`, `components/Mobile/MobileSidebar.vue` | Mobile drawer reuses `AppSidebar` with `mobile`. `desktopOnly` hides Home, Dashboard and Calendar. | nothing | One sidebar for both. Generic items need no `desktopOnly`. |
| `components/Settings/Profile/LandingPageSelect.vue:32-44` | Landing page choices are `getNavigationItems()` plus saved views. Icon comes from `pages.find(p => p.route === view.route_name)`, description is `__(view.route_name)`. | change | Generic doctypes must appear as choices. Stored value must say which doctype. |
| `utils/landingPage.js:1-30` | `landingRoute(page, views, hasRoute)`: a view name or a route name. `viewRoute` defaults `route_name` to `'Leads'`. | change | Needs a doctype-aware branch. The `'Leads'` fallback is correct only for old data. |
| `components/Setup/SetupPreviewApp.vue:61,74` | The setup preview reads `navigationItems` directly. | fallback | Preview of defaults only. Leave as is. |
| `stores/views.js:49-57,59-67` | `getDefaultView()` without an argument walks `homeRoutePriority` (`Leads`, `Deals`, `Contacts`, `Organizations`, `Notes`, `Tasks`, `Call Logs`), then other route names sorted. | fallback | Generic default views will only be found in the "other" tail. Decide if a generic default can be the home. |
| `utils/recentRecords.js:1-17` | `RECENT_TYPES = { Lead: 'CRM Lead', Deal: 'CRM Deal' }`. Records are remembered only for those two route names. The id param is `${route.name.toLowerCase()}Id`. | change | Recent records on generic pages need the doctype from the route param. |
| `components/Home/Widgets/*.vue`, `utils/home.js:12-17`, `utils/brief.js:228-237,391` | Home widgets link to `Deals`, `Leads`, `Tasks`; `recordRoute` returns `Deal` or else `Lead`. | nothing | Out of scope. Home stays Lead and Deal. A task on a generic doctype would still be routed to Lead (see section 7). |

## 3. ViewControls and saved views

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `components/ViewControls.vue:420-433` | Props: `doctype` (required), `filters`, `options`. Default `allowedViews: ['list']`. | nothing | Pass `allowedViews: ['list','group_by','kanban']` (ruling 4). |
| `components/ViewControls.vue:515-517` | Page title is `${route.name} - ${label}` for standard views. | change | `route.name` would be the shared generic name. Use the sidebar label or doctype. |
| `components/ViewControls.vue:610,1552,1796` | New views and standard-view edits save `route_name: _view?.route_name \|\| route.name`. | change | For a generic page this stores the generic route name, the same for every doctype. See `get_route_name` below. |
| `components/ViewControls.vue:1676-1688` | `isDefaultView` and `isStandardDefault` call `getDefaultView(route.name)`. | change | Default view lookup must be by doctype on generic pages. |
| `components/ViewControls.vue:294-296,850,861,872,919,1756` | View switches call `router.push({ name: route.name, params: { viewType } })`. | change | The route params must keep the doctype param. Pushing only `viewType` drops it. |
| `components/ViewControls.vue:245-257` | Import button pushes `NewDataImport` with `params: { doctype }`, hidden for `Data Import`. | nothing | Works for any doctype. Check the doctype is importable. |
| `components/ViewControls.vue:720-722` | On enrichment done, reloads the organizations store when `doctype === 'CRM Deal'`. | nothing | Only `CRM Deal`. |
| `components/ViewControls.vue:1377-1380` | `getKanbanStatusType` returns Lead and Deal status types, else `null`. Used at `1446` to ask for a lost reason on a card move. | fallback | `null` means no lost-reason prompt. Correct default. |
| `components/ViewControls.vue:345-351` | `LostReasonModal` gets `:doctype="props.doctype"`. | nothing | Only opened for Lead and Deal (above). |
| `components/ViewControls.vue:1377-1380` (Kanban column type) and `components/GroupSummaryTable.vue:88-89` | Status colours for group-by: Lead and Deal only. | fallback | Generic returns `''` (no colour). Option: colour from a Select option, later. |
| `components/ViewControls.vue:1367-1375` (`persistCustomView`) | Posts to `crm.fcrm.doctype.crm_view_settings.crm_view_settings.update` with `view.doctype = props.doctype`. | nothing | Saves `dt`. |
| `components/Modals/ViewModal.vue:119-130` | `create` and `update` with `view.doctype = props.doctype`. Placeholder text says "My Open Deals". | nothing | Cosmetic. |
| `components/Filter.vue:232-246` | `idFieldDoctypes = ['CRM Lead','CRM Deal']` marks `name` with an ID icon. | fallback | Other doctypes get the plain "Name" label. |
| `components/ListBulkActions.vue:194-199` | "Convert to Deal" action when `doctype === 'CRM Lead'`. | nothing | Lead only. |
| `components/ListBulkActions.vue:234-245`, `utils/index.js:394-418` | List scripts (`data.list_script`) add header actions and bulk actions. | nothing | Generic: scripts come from `CRM Form Script` rows of view `List`. |
| `stores/views.js:13` | Comment and code: "Keyed by route_name (e.g. 'Leads', 'Deals') so each doctype keeps its own default". | change | The key is the route name, not the doctype. If all generic doctypes share a route name, they share one default. Key by `dt` (or `dt` plus route). |
| `stores/views.js:22-45` | Fills `defaultViews[view.route_name]`, `standardViews[dt + ' ' + type]`, pinned and public lists. | change | Same: `defaultViews` must also be reachable by `dt`. |
| `stores/views.js:69-76` | `getView(name, type, doctype)`: a named view is looked up in `viewsByName` with no doctype check. | fallback | A view name in `?view=` is trusted. Add a `dt` check on generic pages. |
| `utils/view.js:20-27` | `getView` wraps the store and adds a default icon. | nothing | Generic. |
| `crm/api/views.py:5-16` `get_views(doctype)` | Returns the user's and global views, filtered by `dt` when given. The store calls it with `''` (all doctypes). | nothing | Generic. Includes views for doctypes the user can no longer read. Hide those in the sidebar. |
| `crm/fcrm/doctype/crm_view_settings/crm_view_settings.py:333-341` `get_route_name` | `route_name` default: strip `CRM `, add `s` (`CRM Lead` to `Leads`). Used when `view.route_name` is empty (lines 73, 109, 254, 284). | change | For `Sales Order` it gives `Sales Orders`, which is no route. Must default to the generic route name, or the field must hold the doctype. |
| `crm/fcrm/doctype/crm_view_settings/crm_view_settings.json` field `route_name` (Data) | Free text, no validation against routes. | change | One-way door: a stored value is read by `landingRoute`, the sidebar and `router.js`. Decide the meaning of `route_name` for generic views before data is written. |
| `crm/fcrm/doctype/crm_view_settings/crm_view_settings.json` field `dt` (Link DocType) | The doctype of the view. | nothing | The reliable key for generic views. |

## 4. List data API

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `crm/api/doc.py:296` `get_data` | One endpoint for list, group by and kanban for any doctype. Uses `frappe.get_list` (permissions apply). | nothing | Generic by design. |
| `crm/api/doc.py:343-350` | `get_controller(doctype)`, then `default_list_data` and `default_column_keys` if the controller has it. | fallback | Plain doctypes have the `Document` base controller, so `hasattr` is false. |
| `crm/api/doc.py:381-383` | `elif not custom_view or (...)`: sets `rows = default_rows` and `columns = _list.default_list_data().get("columns")` **without** a `hasattr` guard on the first condition. | change | **Bug for generic doctypes.** First visit, no custom view, no standard view saved: the `not custom_view` branch calls `default_list_data()` on a controller that has none, so it raises `AttributeError`. The fallback columns set at 360-364 (`name`, `modified`) are never reached. Guard it with `hasattr`. |
| `crm/api/doc.py:384-395` | Drops `hidden` fields from columns unless the doctype lists them in its defaults. | nothing | Generic. |
| `crm/api/doc.py:360-364` | Fallback columns: `name` and `modified`, rows `['name']`. | fallback | A poor first list. Generic list needs a better default (title field, `in_list_view` fields from meta). |
| `crm/api/doc.py:404-410` | Adds `group_by_field`, `_seen` (when `meta.track_seen`) and `all_day` (only for `CRM Task`, `add_task_all_day` at 604, also called at 456). | nothing | Generic or no-op. |
| `crm/api/doc.py:425-427` | Kanban: `rows = default_rows` when no rows. | fallback | `[]` when the controller has no defaults. Kanban then needs a `title_field` (next rows). |
| `crm/api/doc.py:439-451` | `default_kanban_settings` read only if the controller has it. Falls back to `title_field = 'name'`, `kanban_fields = ['name']`. Only Lead, Deal and Task define it (`crm_lead.py:540`, `crm_deal.py:374`, `crm_task.py:125`). | fallback | Works. Contacts, Organizations, Notes and Call Logs have no kanban defaults today, so kanban on them is already a generic case. |
| `crm/api/doc.py:429-437` | Kanban columns from `column_field`: Link gives all docs of the linked doctype, Select gives options. Other field types crash: `field_meta.fieldtype` is read, `field_meta` may be `None`. | change | Generic kanban needs the column field validated in the UI (only Link or Select), and a clear error otherwise. |
| `crm/api/doc.py:609-613` `parse_list_data` | Calls the controller's `parse_list_data` if it exists (only `crm_call_log.py:134`). | nothing | Optional hook. |
| `crm/api/doc.py:721-751` `set_activity_counts` | Kanban card counts: emails, comments, tasks, notes per record, with `reference_doctype: doctype`. | nothing | Doctype-keyed. Works for any doctype. |
| `crm/api/doc.py:540-551` | Response includes `form_script` and `list_script` from `get_form_script(doctype[, "List"])`, plus `views`, `fields`, `total_count`. | nothing | Generic. |
| `crm/api/doc.py:168-209` `get_quick_filters` | Quick filters from `CRM Global Settings` or `in_standard_filter` fields. Removes `converted` for `CRM Lead` (206-207). | fallback | Generic doctypes without `in_standard_filter` fields get no quick filters. |
| `crm/api/doc.py:24-166` `sort_options`, `get_filterable_fields`, `get_group_by_fields` | Built from meta. | nothing | Generic. |
| `crm/api/doc.py:261-293` `apply_comments_filter` | Comment filter for any doctype. | nothing | Generic. |
| `crm/api/doc.py:705-718` `get_fields` | Meta fields for any doctype. | nothing | Generic. |
| `crm/api/doc.py:671-676` `add_seen` | Marks a record seen. | nothing | Needs `track_seen` on the doctype. |
| `crm/api/doc.py:754-804` `get_linked_docs_data` | Titles for linked docs: special cases `CRM Call Log`, `CRM Deal`, `CRM Notification`. | fallback | Default is the doc `title` or `name`. |
| `crm/api/doc.py:893-930` `delete_bulk_docs` | `remove_contact=doctype == "Contact"`. | nothing | Contact only. |
| `stores/meta.js:9-24` `getMeta` | `frappe.desk.form.load.getdoctype`, cached per doctype. | nothing | Generic. |
| `frontend/src/components/ListViews/EmptyState.vue` (props `name`, `icon`, `importDoctype`) | Each page passes name, icon, texts and `docsLink`. | change | Generic empty state needs defaults from the doctype. |

## 5. Record page parts

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:116-149` `get_sidepanel_sections` | Returns `[]` when no `Side Panel` layout row exists for the doctype, or when the layout is empty. | change | A generic record page with no layout shows an empty side panel. Build a default from meta (as `get_default_layout` does for tabs), or call `get_fields_layout`. |
| `crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:30-112` `get_fields_layout` | Reads the layout by `(dt, type)`. Falls back to `get_default_layout(doctype)` (219-262), built from meta, for every type except `Required Fields`. | fallback | Works for generic doctypes. `Quick Entry`, `Data Fields`, `Grid Row` all get a default. |
| `crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:197-216` `save_fields_layout` | Needs write permission on `CRM Fields Layout`. Creates the row if missing. | nothing | Works for any doctype. |
| `pages/Lead.vue:657-662` (same in `Deal.vue`, `Organization.vue`, Mobile pages) | `sections` resource: `get_sidepanel_sections` with a literal doctype, cache key `['sidePanelSections', 'CRM Lead']`. | nothing | Pass the doctype. |
| `components/SidePanelLayout.vue:474` | `doctype` prop defaults to `CRM Lead`. Inline edit, link create (`createDocument(field.options, ...)` at 551-554). | nothing | Pass explicitly. |
| `components/SidePanelLayoutEditor.vue:151`, `Modals/SidePanelModal.vue:75,93` | Editor for the side panel layout. Default doctype `CRM Lead`. | nothing | Takes a doctype. Opened from the side panel's edit button (`SidePanelLayout.vue:25`). |
| `components/Activities/DataFields.vue:134`, `Modals/DataFieldsModal.vue:54,72` | "Data" tab: `get_fields_layout` with type `Data Fields`. | nothing | Generic. Gives a free record body for a generic doctype (default layout from meta). |
| `components/AssignTo.vue:38-47` | `ownerField` is `lead_owner` for `CRM Lead`, `deal_owner` for `CRM Deal`, else `null`. | fallback | `null` is handled. Assignment still works through `frappe.desk.form.assign_to` and `crm.api.doc.get_assigned_users`. |
| `components/Modals/EditValueModal.vue:146-152` | Lost-reason prompt for status `Lost`, Lead and Deal only. | nothing | Not triggered for others. |
| `stores/statuses.js:84,94` | `statusOptions('deal' \| 'lead')`: only two status stores (`CRM Lead Status`, `CRM Deal Status`). | change | Generic status display must come from the doctype's own Select options or Link target. Ruling 5 (workflow state) is a different source. |
| `components/Home/HomeCell.vue:84`, `components/Home/Widgets/TeamOverview.vue:23` | Status colour and filters for Lead and Deal. | nothing | Home only. |
| `components/CommentBox.vue:106`, `CommunicationArea.vue:126,307`, `EmailEditor.vue:238-239`, `Modals/LostReasonModal.vue:58`, `Controls/GridRowFieldsModal.vue:54`, `FieldLayoutEditor.vue:284`, `Modals/QuickEntryModal.vue:55`, `Modals/DataFieldsModal.vue:54`, `Modals/SidePanelModal.vue:75` | Props with `default: 'CRM Lead'`. `EmailEditor` default subject is "Email From Lead". | fallback | Every caller must pass the doctype. A missing prop silently targets Lead. |
| `data/document.js:489-502,540-541` | `triggerOnCreateLead` and `triggerConvertToDeal` are on every `useDocument`. | nothing | Unused for others. |
| `data/script.js:30-60,290` and `doctypes/crm_task/form.js`, `doctypes/fcrm_note/form.js` | `CRM Form Script` by `dt` and view, plus file scripts matched by slug from `import.meta.glob('../doctypes/*/*.js')` at build time. | nothing | Admin form scripts work for any doctype. File scripts exist only for the built-in ones. |
| `doctypes/crm_task/form.js:17`, `doctypes/fcrm_note/form.js:13` | Open the task or note's parent: `reference_doctype == 'CRM Deal' ? 'Deal' : 'Lead'`. | change | Wrong route for a task or note on a generic doctype. See section 7. |
| `components/EnrichFromWebsite.vue` (`Organization.vue:17-22`) | Domain enrichment on organization. | nothing | Org-specific part to keep as a page extension. |
| `pages/Organization.vue:1-60,130-300,440-520` | Header actions (`EnrichFromWebsite`, New Deal, Add Contact), logo upload, delete, "deals" and "contacts" tabs, `useDocument`, `getMeta('CRM Deal')`. | change | These are the page extensions needed for Organization: header actions, image header, extra tabs. |
| `components/Controls/Link.vue` | Link field popover. There is no "open record" link or route in it. | change | Ruling 7 is new work: nothing exists to extend. |
| `components/CustomActions.vue`, `composables` `document.actions`, `statuses`, `tabs` in `data/script.js:280-380` | Form scripts can set `actions`, `statuses`, `tabs`. | nothing | Generic. A good base for page extensions. |

## 6. Activities

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `crm/api/activities.py:15-23` `get_activities(name)` | Takes **only a name**. Checks `CRM Deal` first, then `CRM Lead`, else throws `Document not found`. | change | No doctype argument. A generic doctype always gets "Document not found", and a generic name equal to a Deal name returns the Deal. Needs a generic path, taking `doctype`. |
| `crm/api/activities.py:26-142` `get_deal_activities`, `145-240` `get_lead_activities` | Permission check, `get_docinfo("", doctype, name)`, version changes, comments, calls, notes, tasks, attachments. Deal merges the converted Lead's history (49-60). | change | The generic version is the Lead path without the Lead-only parts (`is_lead`, `converted`, `lead`). |
| `crm/api/activities.py:285-320` `get_field_change_activities(version, fields, avoid_fields, is_lead)` | Builds change rows; `is_lead` flips texts and `avoid_fields`. | fallback | Pass `is_lead=False` and empty `avoid_fields`. |
| `crm/api/activities.py:385-492` `get_linked_calls`, `494-511` `get_linked_notes`, `559-577` `get_linked_tasks` | Filter by `reference_docname == name` only, **not** by `reference_doctype`. | change | Names are only unique per doctype. A generic doctype with series names (for example `ORG-0001` style) can show another doctype's notes and tasks. Add `reference_doctype`. |
| `crm/api/activities.py:242-255` `get_readable_fields(doctype)`, `257-276` `get_attachments(doctype, name)` | Take a doctype. | nothing | Generic. |
| `components/Activities/Activities.vue:679` | Prop `doctype` default `CRM Lead`. | nothing | Pass the doctype. |
| `components/Activities/Activities.vue:720-735` | `get_activities` resource with `params: { name }` only, cache key `['activity', docname]`. | change | Add the doctype to params and to the cache key. |
| `components/Activities/Activities.vue:741-747` | WhatsApp `references`: for `CRM Deal` also the converted Lead. | nothing | Deal only. |
| `components/Activities/Activities.vue:1010-1030` `timelineIcon(type, is_lead)` | Creation icon is `LeadsIcon` or `DealsIcon`. | fallback | Add a generic creation icon. |
| `components/Activities/AllModals.vue:134-142` | `redirect(tab)` pushes the hash only when `route.name == 'Lead' \|\| 'Deal'`. | change | Tab redirect after create (task, note, call) is dead on other routes. |
| `components/Activities/AllModals.vue:93-105` | After insert or update: name is `note`, `task` or `call_log`, by `d.doctype`. | nothing | Keyed on the child doctype. |
| `components/Activities/AllModals.vue` (call log defaults at ~118-125, task and note modals above it) | Tasks, notes and call logs created from the page carry the parent doctype. | nothing | `reference_doctype` is `Link DocType`, `reference_docname` is `Dynamic Link` (`crm_task.json:96-105`, same on note and call log). Storage is generic. |
| `crm/api/email.py`, `components/CommunicationArea.vue:307` | Emails are saved as `Communication` with `reference_doctype: props.doctype`. | nothing | Storage generic. Hooks restrict some effects (section 12). |
| `components/Activities/EventArea.vue`, `crm/api/event.py:520-525` `visible_events` | An `Event` linked to a record is visible only if the user can read a `CRM Lead` or `CRM Deal` it references. | change | Event tab on a generic doctype needs a decision: drop it or generalise the visibility rule. |
| `frontend/src/components/Activities/ActivityHeader.vue`, tab arrays in `pages/Lead.vue:590-650` | Tab list is a literal array per page: Activity, Emails, Comments, Data, Events, Calls, Tasks, Notes, Attachments, WhatsApp. | change | Generic page declares its default tabs once. Tabs on a doctype with no activity backend (versions, comments) must degrade. |
| `utils/activityHash.js:1-12` | `#notes/<note>` for `FCRM Note`, else `#<hash>`. | nothing | Generic. |

## 7. Tasks, Notes, Call Logs: links back to the parent

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `pages/Tasks.vue:130-145,421-428` | Row button label `Deal` or `Lead`; `redirect(doctype, docname)` pushes `Deal` or `Lead`. | change | A task on a generic doctype opens `Lead` with a wrong id. Needs a doctype to route resolver. |
| `pages/Deals.vue:557,572,583`, `pages/Leads.vue:584,599,610` | Create task and note with fixed `reference_doctype`. | nothing | Per page. |
| `components/Modals/CallLogDetailModal.vue:242-244,346-351,416` | Call log links: `_lead` to `CRM Lead`, `_deal` to `CRM Deal`; routes `Lead` and `Deal`. | change | Same resolver. |
| `components/Calendar/CalendarEventPanel.vue:134-139,464-496,1049-1067` | Event panel icons, labels and filters for `CRM Lead` and `CRM Deal` only. | nothing | Calendar is out of scope. |
| `utils/home.js:12-17` `recordRoute`, `taskRecordRoute` | `CRM Deal` gives `Deal`, anything else gives `Lead`. | change | One resolver `(doctype, name) -> route` is the shared fix. It replaces the copies in `Tasks.vue`, `home.js`, `useCRMCommands.js:415`, `askFlow.js:8-13`, `NotificationRow.vue:49-57`, `CallLogDetailModal.vue`, `ExotelCallUI.vue:442-447`. |
| `components/FlowChat/askFlow.js:8-13` | `RECORD_ROUTES` maps `Lead`, `Deal`, `Contact`, `Organization` to doctype and id param. | change | Part of the same resolver. |

## 8. Command palette

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `components/CommandPalette/useCRMCommands.js:293-307` `navigationCommands` | One "Navigate" command per `getNavigationItems()` entry, `router.push({ name: item.route })`. | change | Generic sidebar items need `perform` with the generic route. Free once the sidebar list is shared. |
| `components/CommandPalette/useCRMCommands.js:310-330` `createCommands` | Fixed "Create" commands: Lead, Deal (open their list page and fire an event), Contact, Organization, Note, Task (open `showModal({ doctype })`). | change | Add "Create <Doctype>" for each sidebar doctype. The `showModal` path is generic. |
| `components/CommandPalette/useCRMCommands.js:47-52` `RECORD_ICONS` | Icons for four doctypes, else `'file-text'`. | fallback | Generic default exists. |
| `components/CommandPalette/useCRMCommands.js:395-418` `recordCommand`, `recordRoute` | Subtitle `record.doctype.replace('CRM ', '')`; route `{ name: record.route, params: { [`${record.route.toLowerCase()}Id`]: record.name } }`. | change | `record.route` is a route name from the server. Return doctype and name, build the route on the client. |
| `components/CommandPalette/useCRMCommands.js:274-278` `upcomingRoute` | Same `${route.toLowerCase()}Id` convention. | change | Same. |
| `crm/api/command_palette.py:19-24` `SEARCH_TYPES` | Search scope: `CRM Lead`, `CRM Deal`, `Contact`, `CRM Organization`, each with route name, title field, search fields. | change | Needs the sidebar doctypes. Each needs a title field (`meta.title_field`) and search fields (`meta.search_fields`). |
| `crm/api/command_palette.py:47-80` `_upcoming_tasks`, `64-80` `_upcoming_task` | Tasks link to their record only if `row.reference_doctype` is in `SEARCH_TYPES`, else to `Tasks`. | fallback | A task on an unlisted doctype opens the task list. Safe. |
| `crm/api/command_palette.py:83-114` `_upcoming_slas` | SLA items for `CRM Lead` and `CRM Deal` only. | nothing | Lead and Deal feature. |
| `crm/api/command_palette.py:155-253` `_search_activity`, `_activity_*`, `_recent_doctype` | Activity search (comments, notes, emails) per readable Lead or Deal; recent records by `SEARCH_TYPES`. | change | Activity hits stay Lead and Deal unless the index is widened (next row). |
| `search_sqlite.py:11,27-90` `PARENT_DOCTYPES = ["CRM Lead", "CRM Deal"]` | The activity full-text index covers Comment, FCRM Note and Communication only when the parent is a Lead or Deal. Prefilter lists all Leads and Deals (84-85). | change | Generic doctypes are not in the index. Widening it is a one-way door (reindex, size). Treat as out of the first release. |
| `components/CommandPalette/activityCommands.js:6-18` | `SOURCES` by `source_doctype`; jumps to a tab hash. | nothing | Keyed on the child doctype. |
| `components/CommandPalette/recordCommands.js:1-150` | Record commands (assign, comment, template, create task and note, copy). Take a `context` with `doctype` and `docname`. | nothing | Generic. Needs a context provider on the generic record page (`getCommandPaletteContext`). |
| `components/CommandPalette/askFlowCommands.js`, `utils/commandPalette.js` | Scoring and ask-flow. | nothing | Generic. |

## 9. Notifications, mentions and links

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `crm/api/notifications.py:66` | `reference_doctype` is returned as `"deal"` or `"lead"`. | change | Any other doctype is mislabelled `"lead"`. |
| `crm/api/notifications.py:73` | `route_name` is `"Deal"` or `"Lead"`. | change | Return the real `reference_doctype` and name (they are already in `CRM Notification`). |
| `utils/notifications.ts:8` | Type `route_name: 'Deal' \| 'Lead'`. | change | Follows the API change. |
| `components/NotificationRow.vue:49-57` | Builds the route: name `route_name`, param `dealId` if `Deal`, else `leadId`. | change | Use the resolver (section 7). |
| `crm/api/notifications.py:146-171` `get_hash` | Tab hash by notification type: `#notes/..`, `#comments/..`, `#emails`, `#whatsapp`, `#events`, `#tasks`. | fallback | Works if the generic record page uses the same tab values. If a tab is missing, `useActiveTabManager` falls back to the first tab. |
| `crm/fcrm/doctype/crm_notification/crm_notification.py:63-86` `notify_user` | Stores `reference_doctype` and `reference_name` from `redirect_to_doctype` and `redirect_to_docname`. | nothing | Storage generic. |
| `crm/fcrm/doctype/crm_notification/crm_notification.py:89-101` `get_record_title`, `record_label` | Title for `CRM Lead` and `CRM Deal`; other doctypes return the name. Label is `deal` or `lead`. | fallback | Name as title is acceptable. Use `meta.title_field` for a better title. |
| `crm/api/comment.py:16-57` `notify_mentions` | Runs from the `Comment` `on_update` hook. Returns at once unless the parent is `CRM Lead` or `CRM Deal`. Reads `lead_name` and `organization` from the parent. | change | An @mention in a comment on a generic doctype sends no notification. Must use the title field. |
| `crm/fcrm/doctype/fcrm_note/fcrm_note.py:44-75` `notify_mentions` | Same gate: `reference_doctype in ("CRM Lead", "CRM Deal")`. | change | Same. |
| `crm/api/comment.py:60-67`, `components/editor/config.ts:30-53`, `components/MentionHoverCard.vue:63-80` | Mentions are **user** mentions (`span[data-type=mention]`, `data-id` is the email). There is no mention of a record. | nothing | Ruling 7 "mention" means the notification a mention creates. No record-mention syntax exists to retarget. |
| `crm/api/todo.py:11-58` | `ToDo` hooks: write-permission check, owner sync (`lead_owner` or `deal_owner`) and notifications for `CRM Lead`, `CRM Deal` (and `CRM Task` for notify). | fallback | Generic doctypes are skipped: assign works through the Frappe ToDo flow, with no CRM notification and no write-permission check from this hook. Frappe's own check still applies. |
| `crm/utils/__init__.py:223,339,361` | `Comment` and `Communication` hooks bump `modified` and record interactions only for Lead and Deal. | fallback | No bump on others. Matches today's behaviour for Contact and Organization. |
| `crm/api/interactions.py:10`, `crm/api/whatsapp.py`, `hooks.py:363` `whatsapp_managed_doctypes` | First-response and WhatsApp features, Lead and Deal only. | nothing | Feature stays Lead and Deal. The generic page hides the WhatsApp tab. |
| `components/Controls/Link.vue`, `components/FieldLayout/Field.vue:116-180`, `components/Controls/Grid.vue:141-192` | A Link field value shows as plain text. No click-through. | change | Ruling 7: a value whose target doctype is in the sidebar needs a link into CRM. For doctypes not in the sidebar, the only precedent is `/app/<slug>/<name>` (`components/Settings/ERPNextSettings.vue:724`). |

## 10. Modals and create

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `components/Modals/DoctypeModal.vue`, `composables/doctypeModal.js:5-26` | Generic create and edit dialog by doctype, name, defaults, callbacks. Layout is `Quick Entry` from `get_fields_layout`. Size and dismiss rule special-case `FCRM Note` (lines 4-5). | nothing | Use for generic create. Default layout falls back to all meta fields. |
| `components/Modals/CreateDocumentModal.vue:50-190` | Generic create used for Link "create new" (`createDocument` in `composables/document.js:42-60`). Title strips `CRM ` and `FCRM `. | nothing | Generic. Also special case `CRM Product` (`document.js:44`). |
| `crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:30-112` for `Quick Entry` | No layout row gives every meta field, including read-only and hidden ones. | fallback | Open question: create as dialog or as a new record page (map "Quick Entry"). Defaults should drop hidden, read-only and system fields. |
| `components/Modals/LeadModal.vue:82-191`, `DealModal.vue:105-240`, `ContactModal.vue:176`, `OrganizationModal.vue:120` | Per-doctype create modals; after create, `router.push({ name: 'Lead' \| 'Deal' \| 'Contact' \| 'Organization', params })`. | change | Generic create navigates to the generic record route. Organization's modal is replaced when it moves. |
| `components/Modals/ConvertToDealModal.vue:72-304` | Lead to Deal conversion. | nothing | Lead only. |
| `components/Modals/GlobalModals.vue:5` | Mounts `CreateDocumentModal` for any `createDocumentDoctype`. | nothing | Generic. |
| `components/ListViews/EmptyState.vue:32` | Import button pushes `NewDataImport` with `importDoctype`. | nothing | Generic. |
| `pages/DataImport.vue:41-42,96,119`, `components/LegacyDataImport.vue:19-24`, `utils/dataImport.ts` | After an import, links to the list and record page only for `CRM Lead` and `CRM Deal`; breadcrumb to `Data Imports`. | change | An import from a generic list returns to a generic route. |

## 11. Mobile

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `router.js:45,57,81,93` | Record routes load `Mobile<Name>.vue` below 768 px via `handleMobileView`. | change | Ruling 6: generic pages have one responsive layout, so no mobile variant. |
| `pages/MobileLead.vue`, `MobileDeal.vue`, `MobileContact.vue`, `MobileOrganization.vue`, `MobileNotification.vue` | Hand-built mobile record pages, each with fixed doctype literals. | nothing | Not touched. Organization on the generic page loses `MobileOrganization.vue`, so the Organization migration must cover phone width. |
| `components/Layouts/layouts.js:11-13`, `App.vue:35` | Shell by `window.innerWidth`: `< 640` mobile. | fallback | See section 1: 640 against 768. |
| `components/Layouts/AppSidebar.vue:222`, `utils/navigation.js:8-35` | `desktopOnly` items hidden on mobile. | nothing | Generic items are shown on both. |
| `composables/settings.js:26` `isMobileView` | `window.innerWidth < 768`, a computed that does not track resize. Used by `DoctypeModal.vue`, `UserMenu.vue`. | fallback | Do not rely on it for layout. Use CSS breakpoints. |
| `router.js:204-205` | On mobile, `Home` redirects to the default view or `Leads`. | fallback | See section 1. |
| `components/ListViews/*ListView.vue`, `Kanban/KanbanView.vue` | Same list components for phone and desktop. | nothing | Already responsive. Check the generic list page at phone width. |

## 12. Settings and layout editors

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `components/Settings/Settings.vue:76,255-280` | Fixed settings pages. No sidebar editor. | change | New: a place where an admin adds, orders and hides sidebar doctypes (map "Sidebar editor"). Where the sidebar config is stored is a one-way door. |
| `components/Settings/AppMenu/*`, `composables/appMenu.js` | Editor for the **app dropdown** menu (logo links), not the sidebar. | nothing | Do not confuse. Useful as a UI pattern. |
| `components/FieldLayoutEditor.vue:284`, `SidePanelLayoutEditor.vue:151` | Layout editors. Take a doctype, default `CRM Lead`. | nothing | Open from the record page (admin only). |
| `components/Modals/QuickEntryModal.vue:55-124`, `composables/modals.js` | Quick entry layout editor. Saves via `save_fields_layout` (`type` `Quick Entry` or `Required Fields`). | nothing | Generic. |
| `components/Settings/DefaultsSettings.vue:155` | Edits `System Settings`. | nothing | Unrelated. |
| `components/Settings/Forms/FormsList.vue:175-176`, `FormBuilderPanel.vue:724-725,991,1283`, `crm/api/form.py:20` (`ALLOWED_DOCTYPES = ("CRM Lead","CRM Deal")`) | Web form builder: Lead and Deal only. | nothing | Out of scope (web forms). |
| `components/Settings/BookingPages/*`, `Sla/*`, `AssignmentRules/*`, `EmailTemplate/*`, `Profile/EmailSubjectSettings.vue:83-121`, `WhatsAppAccountPage.vue:81-85`, `WorkflowAutomations/WorkflowAutomationBuilder.vue:292` | Lists of `CRM Lead` and `CRM Deal` as the only choices. | nothing | Features stay Lead and Deal. A generic doctype is not offered. |
| `components/Settings/DashboardSettings.vue:230` | `route.name === 'Deal'` check. | nothing | Dashboard. |
| `components/Settings/ERPNextSettings.vue:724` | Builds `/app/<doctype>/<name>` desk links. | nothing | Precedent for a desk fallback link. |

## 13. Backend hooks and server code

| Where | What it does | Verdict | Note |
|---|---|---|---|
| `hooks.py:20-22` `add_to_apps_screen` and `crm.api.check_app_permission` | Gate for the CRM app. | nothing | Unchanged. |
| `hooks.py:75-79` `website_route_rules` `/crm/<path:app_path>` to `crm` | Server route for the whole SPA. | nothing | Any `/crm/...` path serves the same page. No server change for new generic routes. |
| `www/crm.py:73-100` `get_boot` | Custom boot dict: no `user` permissions, no doctype list, no sidebar config. | change | The sidebar config and a "can read" list need an API call or a boot key. A boot key is a one-way door once users depend on it. |
| `hooks.py:143-161` `permission_query_conditions` and `has_permission` | Custom permission for `CRM Lead`, `CRM Deal`, `CRM Call Log`, `CRM Notification`, `Data Import`, and others. | nothing | Generic doctypes use standard Frappe permissions. `get_data` uses `get_list`, which applies them. |
| `hooks.py:264-335` `doc_events` | Hooks on `Contact`, `ToDo`, `Communication`, `Comment`, `CRM Deal`, `CRM Lead`, `WA Message`, and others. | fallback | See the rows for `todo.py`, `comment.py`, `utils/__init__.py` in section 9. They skip generic doctypes. |
| `hooks.py:245-258` `override_doctype_class` and mixins | `Contact`, `Email Template`, `Data Import`, `Assignment Rule`. | nothing | Unrelated. |
| `crm/api/session.py:151-173` `get_organizations` | Loads all `CRM Organization` rows once at app start into `stores/organizations.js`. | fallback | Organization-specific cache. When Organization moves, the Deals list still reads it (`ViewControls.vue:720-722`). |
| `crm/api/home.py:94`, `crm/api/dashboard.py`, `crm/automation/*`, `hooks.py:166-232` | Home counts, dashboard, calendar, automation flows. Lead and Deal. | nothing | Out of scope. |
| `crm/fcrm/doctype/crm_form_script/crm_form_script.py:42` `get_form_script(dt, view)` | Scripts by doctype and view. | nothing | Generic. |
| `crm/install.py:249-281`, `activation.py:28` | Creates default `CRM Fields Layout` rows for built-in doctypes at install. | nothing | Existing sites keep them. A generic doctype has none, so the defaults in section 5 apply. |
| `crm/api/doc.py:24-166` | No access control beyond `frappe.get_meta`. A doctype name from the URL reaches `get_meta` and `get_list`. | change | Validate that the doctype is a sidebar doctype, or at least that it is readable, is not single, child or virtual (ruling 3). `get_list` already rejects an unreadable doctype with `PermissionError`. |

## What the generic pages must handle

1. **Routes.** Add generic routes (list, record) next to the old ones. Give them a name (the layout needs `$route.name`). Keep the doctype in the URL, and keep `view` and `viewType` in the query for breadcrumbs. Multi-segment paths avoid the `/:invalidpath` catch-all. Old URLs, names and params stay.
2. **Route name is the key today.** `route_name` on `CRM View Settings`, `defaultViews` in `stores/views.js`, sidebar keys, the active item, `LandingPageSelect`, `recentRecords`, notifications and the command palette all use a route name as the key. One generic route name breaks all of them. Key by doctype (`dt`) for generic pages. Decide the stored meaning of `route_name` before any generic view is saved. `get_route_name` gives `Sales Orders` for `Sales Order`.
3. **Sidebar.** Items are a static list and the list is built once. Needs a configurable list (built-in page or doctype), reactive, filtered by read permission and by ruling 3, with icon and label from config. Mobile uses the same component.
4. **One link resolver.** Seven places turn `(doctype, name)` into a route and all assume Lead or Deal (`home.js`, `Tasks.vue`, `NotificationRow.vue`, `useCRMCommands.js`, `askFlow.js`, `CallLogDetailModal.vue`, `Exotel`). Add one resolver: sidebar doctype to generic route, built-in to its own route, else a desk fallback. It serves ruling 7 (Link fields, mentions, notifications, palette) and the "Open" targets.
5. **List page.** `ViewControls` is already generic. Fix `get_data` for plain doctypes: the `default_list_data()` call at `doc.py:381-383` raises `AttributeError` when the controller has none and no standard view is saved. Choose better default columns than `name` and `modified`. Kanban needs a Link or Select column field. Group by and kanban work; status colours and lost-reason prompts fall back to none.
6. **Record page.** No side panel layout gives `[]`, so build a default from meta. The `Data` tab already falls back to a meta layout. Tabs: declare a default set; `Emails`, `Comments`, `Tasks`, `Notes`, `Attachments` need no Lead or Deal code except `get_activities`. Per-doctype tab memory key. Header actions, extra tabs and cells come from page extensions (Organization needs: image header, enrich, New Deal, Add Contact, contacts and deals tabs).
7. **Activity backend.** `get_activities(name)` knows only Lead and Deal and takes no doctype. Needs a generic path taking `doctype`. Calls, notes and tasks are filtered by `reference_docname` only, so add `reference_doctype`. Add the doctype to the frontend cache key. Storage (`reference_doctype` Link and `reference_docname` Dynamic Link) is already generic.
8. **Hooks that skip generic doctypes.** Mention notifications (`comment.py`, `fcrm_note.py`), `ToDo` owner and notify (`todo.py`), `modified` bumps and interactions (`utils/__init__.py`, `interactions.py`), activity search index (`search_sqlite.py`), notification title (`get_record_title`). Each is a decision: leave it Lead and Deal only, or generalise. Mentions and the palette matter for ruling 7.
9. **Submittable doctypes and workflow (ruling 5).** Nothing exists in `frontend/src`: no `docstatus` UI, no submit, cancel, amend, no workflow state. `useDocument` uses `createDocumentResource` and gives no workflow data. All new.
10. **Mobile (ruling 6).** One layout. No `Mobile*.vue`. The shell breakpoint is 640 and `isMobileView` is 768, so pick one. Moving Organization removes `MobileOrganization.vue`.
11. **Defaults that silently point at Lead.** Props defaulting to `CRM Lead` (`CommentBox`, `CommunicationArea`, `EmailEditor`, `SidePanelLayout`, `ListRows`, `Filter`-related modals) must be passed on every generic call site.
12. **Saved views.** Resolve a named view with a doctype check (`router.js:280-297`, `stores/views.js:69-76`), so a label shared by two doctypes does not cross over. Hide views of a doctype the user cannot read.
13. **Stays Lead and Deal.** SLA, assignment rules, booking, WhatsApp, web forms, email templates, workflow automations, home, dashboard, calendar, convert, lost reason. The generic pages should not offer them for other doctypes.
14. **Validation.** `get_data` and the generic routes should reject singles, child tables and virtual doctypes, and show a not-found or not-permitted state. Today only `frappe.get_list` permission checks protect the endpoint.

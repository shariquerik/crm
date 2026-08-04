---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariquerik
blocked_by: [001-feed-data-sources.md, 002-doc-state-ownership.md]
status: closed
---

# The tab contract

## Question

A tab is stored as a `Navigation Item` whose `type` names its content
([CONTEXT.md:23](../../../CONTEXT.md)). The static build hardcodes that list as data —
`NavigationItem[]` read through `useRecordLayout()` — so customization later swaps one
composable's source and touches no consumer.

That only works if every tab satisfies one interface. Define it:

- What a tab component receives. The doc and its dirty state reach it from
  [Who owns the doc and its dirty state](002-doc-state-ownership.md); the feeds need whatever
  [What backs Activity, Emails and Files](001-feed-data-sources.md) turns up.
- How `type` resolves to a component, in a shape `registerRecordComponent` can extend later
  without the static version pretending to be a registry.
- Whether tabs mount lazily and whether they keep state across a switch. The Details tab holds
  a half-edited form; a feed holds scroll position.
- Which tabs are real on day one and which are stubs. Defaults are Activity, Emails, Files,
  Details; `record-page.md:36` adds calls, tasks and notes for `CRM Lead` and `CRM Deal`.
- What the composer's `+` menu reads to derive one create action per tab kind, since
  `record-page.md:62` makes that menu a function of the tab list.

## Read first

Paths are relative to `frontend2/`.

- [../map.md](../map.md), then this ticket.
- **The two tickets that blocked this one**, resolutions included:
  [What backs Activity, Emails and Files](001-feed-data-sources.md) and
  [Who owns the doc and its dirty state](002-doc-state-ownership.md). Their answers are this
  ticket's inputs — do not re-decide them.
- `docs/research/record-page-feeds.md` — the research output behind ticket 001.
- `CONTEXT.md` — **Tab** (line 23), **Details tab** (line 36), **Surface** (line 46).
- `docs/record-page.md` — "The full form is a tab, not a mode" (line 33) for the default tab
  list and the CRM additions; "The composer floats over the feed" (line 60) for the `+` menu's
  dependency on that list.
- `docs/adr/0001-customization-storage-lives-in-the-framework.md` — tabs are stored as
  `Navigation Item` under a `Navigation` scope keyed by app, doctype and `surface`. That fixes
  the type the static literal has to satisfy.
- `src/data/rail.ts` and `src/data/railLayout.ts` — this app already consumes `Navigation` for
  the sidebar. Whatever types and helpers exist there are the ones the tab list should reuse.
- Reference only, do not move: `src/pages/prototypes/generic/GenericRecordPrototype.vue`
  (the tab strip and switching), `GenericTimeline.vue`, `GenericComposer.vue`.

## How to resolve

`/grilling`, plus `/domain-modeling` — the tab contract is a piece of the ubiquitous language,
so anything it names belongs in `CONTEXT.md`.

## The answer must say

- The interface a tab component implements, written out as a TypeScript type.
- How `type` resolves to a component, and how `registerRecordComponent` extends that later
  without the static version pretending to be a registry.
- Whether tabs mount lazily and whether they keep state across a switch, answered separately
  for a half-edited Details form and for a feed's scroll position.
- The day-one tab list, marking each entry real or stub.
- What the composer's `+` menu reads.
- The shape of the `useRecordLayout()` literal for tabs, concrete enough to write.

## Resolution

### The interface

Every tab component declares the same props and ignores what it does not use. A uniform
superset over a context bag, because it keeps each tab a plain component that a test can mount
with literals, and it matches the `v-model:doc` convention
[Who owns the doc and its dirty state](002-doc-state-ownership.md) settled for the panel and the
Details tab.

```ts
type TabProps = {
  /** The tab's own stored config — one component can back several tabs. */
  item: NavigationItem
  /** `v-model:doc`. Only the Details tab writes; the feeds ignore it. */
  doc: Record<string, any>
  doctype: string
  docname: string
  /** The eleven `getdoc` buckets, from `useDocinfo`. */
  docinfo: Docinfo
  /** The Emails pager and the Files list query. */
  feeds: Feeds
}

// emits: 'update:doc'
```

Details uses `doc`; Activity and Files use `docinfo`; Emails uses `docinfo` plus `feeds`.

`item` is the pressure valve the superset needs. Passing a tab its own `Navigation Item` means
one component can back several tabs — a linked-records feed reads `item.dt` and serves Calls,
Tasks and Notes alike — and a new knob on a tab kind becomes a `Navigation Item` field rather
than a new prop every tab has to re-declare.

The id prop is **`docname`**, not `name`. The route param is `:id` (`router.ts:30`), but `name`
would collide with `item.name`, and `docname` is frappe's own word.

### How `type` resolves to a component

`src/data/tabTypes.ts` holds a frozen literal and exports one function:

```ts
const TABS: Record<string, TabKind> = {
  activity: { component: ActivityTab },
  emails: { component: EmailsTab },
  files: {
    component: FilesTab,
    create: { label: 'Attach a file', icon: 'lucide-paperclip', run: (ctx) => ctx.attach() },
  },
  details: { component: DetailsTab },
}

export function resolveTab(type: string): Component {
  return TABS[type]?.component ?? UnknownTab
}
```

No `register()`, no `Map`, no fallback entry keyed by a magic string — the static version does
not pretend to be a registry. `resolveTab`'s **body** is the single seam: when
`registerRecordComponent` ships on the frappe side, that body becomes a call into the framework
registry and no consumer changes. `@framework/ui` already runs this pattern one layer down for
fieldtypes (`Fields/fieldTypes.ts:29-64` behind `useFieldTypes().resolve`), so the registry this
grows into has a working precedent rather than a fresh design.

A registered extension supplies a `TabKind`, not a bare component, so it brings its create
action with it.

### Mounting, and state across a switch

**One tab mounted at a time**, destroyed on switch — plain `<component :is>`, no `<KeepAlive>`.
Lazy mounting saves no requests either way:
[What backs Activity, Emails and Files](001-feed-data-sources.md) established that one `getdoc`
serves all three feeds, so a tab switch costs zero fetches.

The two state cases answer differently, and neither needs `KeepAlive`:

- **A half-edited Details form survives the unmount for free.** `doc` lives in `useRecordPage`
  above the tab, so switching away and back re-renders the same edited ref. Only transient UI —
  focus, an open dropdown — is lost, and that is the correct thing to lose.
- **A feed's scroll position** is restored through `useRestoredRef`, keyed per tab
  (`scroll:${item.name}`). This beats `KeepAlive` rather than merely matching it: page state is
  keyed to the history entry, so position also survives leaving the record and coming back,
  which a kept-alive component cannot do.

One prerequisite: `useScrollRestore` hardcodes the key `'scrollTop'` (`usePageState.ts:26`).
It has to take the name, the way `useRestoredRef` already does.

`KeepAlive` was rejected because it solves the smaller half of the problem while page state
solves both, and it would leave every visited tab's watchers and realtime subscriptions running
behind the one on screen. Running both was rejected as two owners of one concern.

### The day-one tab list

Four tabs, **all real**, in this order:

| Tab | State | What backs it |
| --- | --- | --- |
| `activity` | real | Eleven `docinfo` buckets assembled client-side |
| `emails` | real | `docinfo.communications` plus the `get_communications` pager |
| `files` | real | One `File` list query, for the timestamps `docinfo.attachments` lacks |
| `details` | real | `FormLayout`, lifted from `Detail.vue`'s body |

No stubs. A stubbed tab is a visibly empty tab in a shipped product — worse than not listing it.
Only Activity is genuinely new work; the other three are thin. Calls, tasks and notes
(`record-page.md:37`) are Lead- and Deal-specific and already out of this map's scope.

**The first tab opens**, so no default is stored anywhere. `Details` stays last, as
`record-page.md`'s diagram and the prototype both render it: the side panel already holds every
field in collapsible sections, so Details is the overflow surface, not the primary one. Opening
on Activity says the record page is a conversation surface first — and opening on the form would
make it read like the expand/collapse mode `record-page.md:33` retired. This closes
`record-page.md:136`'s first Open item.

### What the composer's `+` menu reads

The same `TABS` table, filtered:

```ts
const createActions = tabs.value
  .map((tab) => TABS[tab.type]?.create)
  .filter(Boolean)
```

`record-page.md:62` makes the menu a function of the tab list, and reading it off the table
`resolveTab` already reads means "which tabs exist" and "what `+` offers" cannot drift apart.

On day one the menu holds **exactly one entry** — *Attach a file*, from Files. Activity and
Details have no create action, and Emails does not need one: Reply and Comment already have
their own controls in the collapsed composer.

### The `useRecordLayout()` literal

```ts
export function useRecordLayout(doctype: MaybeRefOrGetter<string>) {
  return { tabs: computed<NavigationItem[]>(() => RECORD_TABS) }
}

const RECORD_TABS: NavigationItem[] = [
  tabItem('activity', 'Activity', 'lucide-activity'),
  tabItem('emails', 'Emails', 'lucide-mail'),
  tabItem('files', 'Files', 'lucide-paperclip'),
  tabItem('details', 'Details', 'lucide-table-properties'),
]
```

`NavigationItem` has ten required fields (`Navigation/types.ts:13-24`), so `tabItem(type, label,
icon)` fills the rest with their empty defaults — `dt: ''`, `url: ''`, `new_tab: 0`, `hidden: 0`,
`own: 0`, `view: null`, `name` = the type. Without it each entry is ten lines of noise, and the
literal has to satisfy the real type or the later swap is not a swap.

That swap is one line:

```ts
useNavigation(doctype, undefined, { app: APP_NAME, surface: 'record' })
```

It waits on `surface` joining `NavigationScope` (`types.ts:4-7` has only `app` and `doctype`),
which ADR 0001 puts in frappe — out of this map's scope. `src/data/railLayout.ts:12` already
consumes `useNavigation` this way for the sidebar, so the shape is established.

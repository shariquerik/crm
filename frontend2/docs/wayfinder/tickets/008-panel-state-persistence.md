---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariquerik
blocked_by: [003-side-panel-fields.md]
status: closed
---

# Where the panel's own state is kept

## Question

The panel now has a home:
[Where the side panel's fields come from](003-side-panel-fields.md) put it in `@framework/ui` as
`PanelLayout`, a sibling of `FormLayout` over the same composables. That makes its own state
answerable, and splits it in two, because the two halves may not live in the same place:

- **Width** — one number, 320–640px, dragged on the resize edge, plus the collapsed-to-rail flag.
- **Which sections are open** — one boolean per section of one doctype's layout.

Decide, for each half:

- Is it per user, per doctype, or per user *and* doctype? Width feels like a body-sized
  preference that should follow the user everywhere; open sections are about one doctype's
  fields, so they may not.
- Where is it stored — `localStorage`, a user setting on the server, or the Form Layout doctype
  from [ADR 0001](../../adr/0001-customization-storage-lives-in-the-framework.md)? ADR 0001 puts
  *customization* in the framework, and `opened` is already a `Section` field
  (`FormLayout/types.ts:86`) that a layout can ship as its default. So a section's open state may
  be a customization with a per-user override, not plain UI state.
- Who owns it — `PanelLayout` in `@framework/ui`, or the record page in this app? A framework
  component that reaches for `localStorage` on its own is a hazard; a prop and an event may be
  the honest seam.

The answer feeds directly into the seams ticket, which has to name the owner.

## Read first

Paths are relative to `frontend2/` unless absolute.

- [../map.md](../map.md), then the resolution of
  [Where the side panel's fields come from](003-side-panel-fields.md) — it fixes where
  `PanelLayout` lives, which is what makes this answerable.
- `docs/record-page.md` — the panel resize and collapse behaviour (lines 48 and 96), and the
  Open question at line 137 that this ticket closes.
- `docs/adr/0001-customization-storage-lives-in-the-framework.md`.
- `src/composables/usePageState.ts` — how this app already persists per-page UI state
  (scroll position, list state). Whatever this ticket decides should not invent a second
  mechanism where that one fits.
- Reference only, do not move: `src/pages/prototypes/generic/PanelEdge.vue`, which holds the
  drag and collapse affordances the width half applies to.

## How to resolve

`/grilling`. Read `usePageState.ts` first so the existing mechanism is on the table, then put
each half to the human separately — they may well resolve differently.

## The answer must say

- For width and for open sections separately: the scope (per user, per doctype, or both) and the
  store.
- Which component owns the state, and the exact seam if `PanelLayout` does not own it.
- What the panel does on first visit, before anything is stored.

## Resolution

The two halves resolve differently, as the ticket suspected, but neither is a customization and
neither belongs to `PanelLayout`. Both live in `localStorage`, in one composable.

`usePageState.ts` is not the mechanism for either. It keys off `pageState()` and
`window.location.pathname`, so its values die with the history entry — right for scroll
restore, useless for a preference that must survive a reload.

### Width and the collapsed flag

**Per user, global across every doctype.** Width tracks the reader's window and eyesight, not the
record's content. Widening the panel on a Contact and then finding a Deal narrow would read as a
bug, and `record-page.md:39` gives every doctype the same job — every field, in sections — so
there is no content argument for varying it.

**Stored in `localStorage`**, via `useLocalStorage`, which is what `AppShell.vue:231` already does
for `crm-sidebar-collapsed`. Two keys:

- `crm-panel-width` — number, default `380` (the prototype's, `GenericRecordPrototype.vue:93`),
  clamped to 320–640 **on read as well as on drag**, so a stale or hand-edited value cannot
  escape the range `record-page.md:48` fixes.
- `crm-panel-collapsed` — boolean, default `false`.

A server-side user setting was rejected on the read, not the write. The value must be known
synchronously at first paint or the panel renders at a default and then animates to the stored
width — and `record-page.md:96` makes width a transitioned property, so that jump would be
visible every single load. Following the user to a second machine does not buy enough to pay for
that. It is the same trade `crm-sidebar-collapsed` already made.

The drag's `dragging` flag stays transient. It exists to suppress the transition under the
pointer (`PanelEdge.vue:37`), and has no meaning across loads.

### Which sections are open

**Per user and per doctype.** A section is one doctype's fields, so "I keep Contact Details shut"
says nothing about a Deal — and section names are only unique within one layout, so a global
store would collide where it meant anything at all. Per record was rejected as unbounded: the
habit is about the doctype.

**The default already exists and stays on the server.** `fieldsLayout.ts:22` reads
`opened: section.opened !== false` from `CRM Fields Layout` through `get_fields_layout`. That
default is the customization, and it stays where ADR 0001 puts it. No Form Layout doctype is
needed for this half, so this ticket adds nothing to the map's out-of-repo dependency.

**The reader's toggling is not a customization act.** A chevron click is closer to scrolling than
to configuring a doctype, and must not cost a server write. So it goes to `localStorage`:

- Key `crm-panel-sections:<doctype>`, holding a `Record<sectionName, boolean>`.
- **Only divergences from the layout's default are stored.** Toggling a section back to its
  default deletes its entry rather than writing the matching value. Without this, an admin who
  later opens a section by default would be silently overridden forever by every reader who had
  ever touched that panel.

**The key is `section.name`, and for unconfigured doctypes it simply does not persist.** For a
doctype with a saved `CRM Fields Layout` the name comes from the stored JSON: stable, and it
survives reordering. For one without, `get_default_layout`
(`crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:226`) mints names as
`"section_" + random_string(4)` — freshly, on every request — so no stored key ever matches on
read and the panel falls back to the layout's defaults each load. That degrades to doing nothing,
which is the right failure: indices would have persisted for every doctype but, once a layout was
edited, would apply the stored booleans to the wrong sections. A wrong answer is worse than no
answer. Making the generated names deterministic server-side is the root fix and would make this
work everywhere; it is a Python change in `apps/crm`, outside this map's `frontend2` scope, and is
not required — Lead, Deal and Contact all have saved layouts.

Names absent from the current layout are ignored on read and dropped on the next write, so an
edited layout does not accumulate dead keys.

### Who owns it

**One composable, `usePanelState(doctype)`, in `src/composables/`** next to `usePageState.ts`. It
returns `width`, `collapsed` and `openSections`, owns all three `localStorage` keys, and holds the
only non-trivial logic here — the diff between the layout's `opened` defaults and the stored
divergences, in both directions. `Record.vue` sees three refs and no storage detail. The seams
ticket gets one named node to place.

**`PanelLayout` never sees the width.** Width belongs to the `aside` the record page draws, which
also carries the identity block, tags and quick actions — none of them `PanelLayout`'s. So the
hazard the ticket raised, a framework component reaching for `localStorage`, does not need a seam
to avoid; it needs the state to sit one level out, where it already belongs.

**For open sections `PanelLayout` is fully controlled**: `v-model:openSections`, a
`Record<sectionName, boolean>` of the **effective** state for every section. It renders exactly
what that map says and writes the toggled map back. It resolves no defaults and knows nothing of
storage, so the app's divergence-only format never crosses into `@framework/ui`. An uncontrolled
component seeding itself from `section.opened` and emitting a toggle was rejected: it would still
need a prop to restore stored state on mount, leaving the state in two places.

### First visit

Panel expanded — not a rail — at 380px. Sections exactly as the layout's `opened` says, honoured
literally, with no app-side cap on how many may open at once. If that is a wall of fields on some
doctype, the fix is that doctype's layout, which is configurable and is where `record-page.md`
already puts the call. The panel does not second-guess it.

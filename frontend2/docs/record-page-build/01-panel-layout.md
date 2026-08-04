# Slice 01 — `PanelLayout` in `@framework/ui`

**Leaves working:** nothing changes in this app. `/:doctype/:id` still serves today's form.

The plan is [record-page-build.md](../record-page-build.md), and it is the source of truth. This
ticket points at its slice; it does not restate it. Read **What the framework supplies** and **The
traps** before starting.

## When it lands

Nothing to see in `frontend2`. The acceptance test is in the framework repo: a `PanelLayout`
rendering a `CRM Deal`'s sections at 380px wide, one column, label left and value right, each
section header pinning below the ones before it as the list scrolls.

## Files

Created, in `apps/frappe/ui` — a new peer directory of `FormLayout/`, sharing `Fields/` and the
composables with it:

- `ui/src/components/PanelLayout/` — the component, its section and its field row.
- Its export added to the package's export map, matching how `FormLayout` is exported.

`FormLayout` is not touched.

## Decisions it implements

- [Where the side panel's fields come from](../wayfinder/tickets/003-side-panel-fields.md) — why
  this is a sibling rather than a dense mode, and what a row renders.
- [Where the panel's own state is kept](../wayfinder/tickets/008-panel-state-persistence.md) — the
  `v-model:openSections` contract, and why the component never sees a width.

## Prototype

- `src/pages/prototypes/generic/PanelFieldSection.vue:5-27` — the sticky section header, its
  gradient tail, and the hover-revealed chevron after the title.
- `PanelFieldSection.vue:29-56` — the `grid-cols-[130px_1fr]` row, its hover background, the
  `Add {label}...` placeholder and the trailing `↗`.

Lift the markup and the class strings; the prototype's `dirtyState.ts` and `genericMock.ts` have no
successor.

## Framework surface

This slice builds on it rather than consuming it: `resolveLayout`, `useFieldTypes().resolve` and
`formatField`, all already public exports of `@framework/ui/FormLayout`. `PanelLayout` writes no
layout logic of its own.

## Traps

- **Section headers and their fields must be siblings, and the header height fixed at 42px.** A
  sticky header cannot outlive its containing block, so a section may not be wrapped in a
  `<section>` box, and the stacking offsets are only knowable without measuring if the height is a
  constant.
- That repo has **no test runner of its own** — run its vitest from a consuming app with aliases.
- Running `npx prettier` there **reformats untouched lines**. Do not.

## Landed

`frappe@40a70f230c`, on `feat/saved-view-sidebar`. `PanelLayout/` holds `PanelLayout.vue`,
`PanelSection.vue`, `PanelField.vue`, a pure `displayValue.ts` with its tests, and `types.ts`;
`./PanelLayout` joins the export map beside `./FormLayout`. `FormLayout` is untouched.

**`v-model:openSections` is controlled with no floor.** A key the map does not carry renders that
section closed, so `usePanelState` must supply an effective boolean for **every** section, resolving
the layout's `opened` itself. The key is `section.name`, falling back to `section.label` where a
layout has none; never an index, which could not match a name-keyed store.

Three more things the ticket left open, which slice 08 consumes:

- **`expand` is an emit, carrying the `FieldNode`.** A summary fieldtype's `↗` cannot switch tabs
  itself, so the host answers it — `RecordPanel` sets `?tab=` to Details and scrolls to
  `[data-fieldname]`.
- **A `section-action` scoped slot**, `{ section, index }`, is the prototype's per-section header
  action. `GenericRecordPrototype.vue:44-51` hangs _Show all details_ off the first section.
- **A control closes on `change`, on Escape, or on focus leaving the cell**, where a portalled
  popover (`[role="dialog"]`, `[role="listbox"]`, `[role="menu"]`) does not count as leaving.
  Closing on `change` alone would strand a row a user opened and clicked away from.

`displayValue` covers the rest of the fieldtypes: numerics through `formatField` with the site's
format defaults and a resolved currency, `Check` as `Yes`/`No` with no unset state, everything
else its raw string. A `Link` renders its raw name — `_link_titles` is the page's, and no prop
carries it into the framework.

The acceptance render is deferred to slice 08: this branch of `crm/frontend` has no story
infrastructure, so there is nowhere here to mount a `CRM Deal` at 380px. Verified instead by the
13 `displayValue` tests, a clean `vite build` of `frontend2` against the new component, and the
app's own 66 tests still passing.

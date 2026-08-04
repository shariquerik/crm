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

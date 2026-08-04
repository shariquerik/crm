---
parent: ../map.md
labels: [wayfinder:grilling]
assignee: shariquerik
blocked_by: []
status: closed
---

# Where the side panel's fields come from

## Question

This is the map's one dependency risk. `record-page.md:104` states the panel **cannot** use
`FormLayout` as it stands: its columns break on `sm:flex-row`, a viewport breakpoint, so a
two-column section squashes instead of stacking inside a 380px panel; its fields render
label-above-value where the panel wants a `130px / 1fr` grid; and its chevron leads the label
instead of following it.

The document's own recommendation is to add a dense single-column mode to `FormLayout` rather
than write a second renderer, because a panel-only renderer would have to re-derive `depends_on`
and every fieldtype control. That change lands in `@framework/ui`, on a frappe branch — which
this map has ruled out of scope.

So decide which way that tension resolves:

- Block on the framework change, accepting a dependency outside this repo.
- Ship a panel-only renderer now and adopt dense mode later, accepting the re-derivation cost
  and the risk that "later" never arrives.
- Something narrower — a prop, a wrapper, a container-query fix — that is small enough to land
  without the map waiting on it.

Weigh what the prototype's `PanelFieldSection.vue` already proves about the cost of the
second option. Whatever is chosen, say plainly what the panel renders on day one.

## Read first

Paths are relative to `frontend2/` unless absolute.

- [../map.md](../map.md), then this ticket. Note what the map's **Out of scope** section says
  about framework work, and that this ticket is allowed to overturn it.
- `docs/record-page.md` — "The panel holds every field" (line 39) for what the panel owes, and
  "What this needs from the framework" (lines 100–113) for the exact three mismatches. Those
  three claims are the ticket; verify each against the source before deciding.
- The framework source: `/Users/shariq/crm-bench/apps/frappe/ui/src/components/FormLayout/`.
  It is a sibling app repo, aliased as `@framework/ui` (see `vite.config.js:31`). Read
  `FormLayoutSection`'s `collapsible` / `opened` / `hideLabel` props, the `sm:flex-row` column
  breakpoint, the field label layout, and `useScriptedLayout`.
- Reference only, do not move: `src/pages/prototypes/generic/PanelFieldSection.vue` and
  `GenericForm.vue` — the same fields rendered both ways, which is the cost comparison.
- `docs/adr/0001-customization-storage-lives-in-the-framework.md` — it already commits to
  `FormLayout` consuming a framework Form Layout doctype, which bears on the third option.

Editing `@framework/ui` has its own hazards: that repo has no test runner of its own, and
running `npx prettier` in it reformats untouched lines. Check the memory notes on both before
proposing a change there.

## How to resolve

`/grilling`. Verify the three mismatches in the framework source **before** the conversation —
if any of them no longer holds, the whole tension may be smaller than `record-page.md` claims.
Bring what you found, then put the fork to the human.

## The answer must say

- Whether each of the three claimed mismatches is real, with file and line.
- Which way the fork resolves, and what that costs.
- Exactly what the side panel renders on day one, concretely enough to build against.
- If it blocks on framework work: what that change is, where it lands, and what this map does
  while it waits.
- If it does not: what the migration to dense `FormLayout` later actually involves, so the
  decision is not just deferral.

## Resolution

The fork was built on a false premise. The panel does not need a dense `FormLayout`, and it does
not need a second renderer that re-derives anything.

### The three claimed mismatches

Two hold, one does not.

- **`sm:flex-row` — real.** `FormLayoutSection.vue:31` lays columns out with
  `class="flex sm:flex-row flex-col gap-4"`. `sm` is a viewport media query, so at any normal
  window width the branch is taken regardless of how narrow the panel is, and each column
  (`FormLayoutColumn.vue:2`, `flex-1 min-w-0`) squashes to about half of 380px.
- **Label above value — real, but a layer deeper than `record-page.md` claimed.** `FormLayout`
  renders no labels at all. `FormLayoutField.vue:3-10` mounts the resolved control and nothing
  else; each control passes `field.label` to a frappe-ui input's `label` prop
  (`TextField.vue:4`, `LinkField.vue:5`), and `TextInput.vue:2-17` stacks `InputLabel` over the
  control in a `space-y-1.5` wrapper. A dense mode on `FormLayout` could therefore not fix this
  by itself — it would have to reach every one of the 24 components in `Fields/`.
- **Chevron leads the label — false.** `FormLayoutSection.vue:13-22` renders the label span and
  then the chevron span. It already trails. Only two cosmetic details differ from the
  prototype: the framework chevron is always visible where `PanelFieldSection.vue:19` reveals it
  on hover, and it is a `chevron-right` rotated 90 degrees rather than `chevron-down`/`up`.

### How the fork resolves

`FormLayout` is only the UI layer. The logic sits in composables that are already public exports
of `@framework/ui/FormLayout`, and none of them are coupled to the `FormLayout` component:

- `resolveLayout(schema, doc)` (`index.ts:14`) is a pure function that bakes `depends_on`,
  `mandatory_depends_on` and `read_only_depends_on` into `hidden` / `reqd` / `readOnly` on a
  fresh tree.
- `useFieldTypes().resolve(fieldtype)` (`index.ts:2`) returns the control for a fieldtype.
- `formatField(value, { fieldtype, precision, currency })` (`formatNumber.ts:236`) returns the
  display string.
- Every control satisfies one contract — props `{ field, modelValue }`, emits
  `update:modelValue` and `change` (`Fields/types.ts:58-72`) — so a control mounts directly,
  with no `FormLayout` around it.

So the two costs `record-page.md:110-112` used to justify the framework change — re-deriving
`depends_on`, and re-implementing every fieldtype control — do not exist.

The panel is a **sibling UI layer** over those same composables: `FormLayout` renders label above
field, `PanelLayout` renders label left and field right. It is not a mode on `FormLayout`, and
`FormLayout` is not touched.

**`PanelLayout` lands in `@framework/ui`**, as a new peer directory
`ui/src/components/PanelLayout/`, sharing `Fields/` and the composables with `FormLayout/`. That
is a frappe branch, so the map does pick up an out-of-repo dependency — this ticket overturns the
map's blanket **Out of scope** ruling on framework work, for this one additive component. The
cost is the cross-repo branch and its hazards (that repo has no test runner of its own, and
`npx prettier` there reformats untouched lines). The benefit is that the panel is not app-local
duplication: any Frappe app gets a side panel from the same layout resolver.

The map's **planning** blocks on nothing. Only the **build** does, and only at its first slice.

### What the panel renders on day one

Fields are **click-to-edit values**, not live controls.

- A section is `section.columns.flatMap((c) => c.fields)` filtered on `hidden`, so the panel is
  always one column and `sm:flex-row` never applies.
- Each field is one `grid-cols-[130px_1fr]` row: the label in the fixed column, and the value as
  text from `formatField` in the flexible one, with the prototype's hover background and its
  `Add {label}...` placeholder when empty.
- Clicking a row mounts `useFieldTypes().resolve(field.fieldtype)` into that one cell, with
  `{ ...field, label: undefined }` so the control does not render its own label into the grid.
  It writes through to the same doc and the same dirty state the Details tab edits
  (`record-page.md:28`).
- Fieldtypes that have no honest 130px/1fr row — `Table`, `Text Editor`, `Code`, `Geolocation`,
  `Image`, `Attach` — keep the same row shape but show a one-line summary (`3 items`, a
  truncated first line, `Set` / `Not set`) with a trailing `↗`. Clicking switches to the Details
  tab and scrolls to that field. The panel stays uniform and
  "the panel holds every field" (`record-page.md:39`) stays true.
- Section headers stay as the prototype has them: hover-revealed chevron after the title, sticky
  and stacking.

The **Details tab** is `FormLayout` unchanged, exactly as `Detail.vue:19` already renders it. It
looks different from the panel, and that is intended — Details is the full form, the panel is the
dense summary. `GenericForm.vue:8-36` reused the panel's grid only because the prototype had no
real controls in it; it is not a target for the Details tab.

### Dense `FormLayout` is dead, not deferred

There is no migration to describe, because nothing will migrate. The panel and the form are
permanently two surfaces with two jobs over one layout resolver, so a dense single-column mode on
`FormLayout` has no consumer. `record-page.md`'s "What this needs from the framework" section is
rewritten by this ticket to say so.

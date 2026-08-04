# CRM frontend2 — Agent Context

The second CRM frontend, served at `/crm2`. Plain Vue on `frappe-ui` and `@framework/ui`,
with no Studio runtime. It is a port of `crm/studio/crm_studio/`, which it will eventually
replace along with `frontend/`.

It is a **separate workspace from `frontend/` on purpose**: its own `package.json` and
lockfile let it run Vite 8 and frappe-ui beta.29 while `frontend/` stays on Vite 5 and
beta.19. Never reach across into `frontend/`.

## Layout

- `src/pages/` — one component per route. `List.vue` serves both `/:doctype` and
  `/:doctype/view/:viewName`; `Record.vue` serves `/:doctype/:id`.
- `src/components/` — cross-page chrome only. A component one page owns lives under
  `src/components/<page>/`.
- `src/composables/` — page logic. A page's `<script setup>` wires resources to a composable and
  binds the result; it does not hold logic.
- `src/data/` — shared module-scope state and API wiring. `resources.ts` builds every page's
  resources; `fieldsLayout.ts` holds the layout transform both the list and record forms use.

## Build

```
yarn dev          # dev server
yarn build        # writes crm/public/frontend2 + crm/www/crm2.html
yarn test:run
```

Two constraints worth knowing:

- `buildConfig.outDir` must be set inside the `frappeui()` plugin, not in `build`. The
  plugin's config hook overrides `build.outDir`, and the default would empty
  `frontend/`'s output dir.
- `optimizeDeps.include` carries `socket.io-client` and `feather-icons`, which nothing here
  imports directly. Reached only through frappe-ui, they never enter vite's entry scan and
  stay unbundled CJS that fails ESM interop.

- `auto-imports.d.ts` and `components.d.ts` are generated at this folder's root by the
  unplugin hooks, and are gitignored — a fresh clone has none until the first dev or build
  run.

`frameworkUI()` from `@framework/ui/vite` supplies the singleton dedupe (vue, vue-router,
frappe-ui, reka-ui, dompurify) — do not hand-roll a `resolve.dedupe` list.

Vite 8 matters: under Vite 5 the esbuild prebundler runs without vite plugins and cannot
resolve frappe-ui's `~icons/*` (unplugin-icons) or `#molecules/*` imports.

## Dependencies

`@framework/ui` is linked from `apps/frappe/ui` and needs frappe-ui ≥ 1.0.0-beta.24
(`frappe-ui/list`, `SidebarLabel`). beta.29 adds `MultiSelect`'s `filterable`, which a
server-searched picker needs to stop the client re-filtering what the server matched. Its `Navigation`, `SavedViews` and `IconPicker` modules
are not on frappe develop yet, so this app only builds against a frappe branch carrying them.

Import framework subpaths as `@framework/ui/components/<Name>`: the alias points at the
package's `src` directory, so the bare `@framework/ui/<Name>` form in its export map does
not resolve here.

## Agent Guidelines & Code Conventions

### Writing good code

- Choose clean code over clever code.
- Write object oriented code as much as possible.
- Keep function sizes small, ideally 10 lines.
- Write the main code/function first, and helper functions below it in order of usage.
- Keep files small, between 100 and 300 lines.
- Keep directories or modules small, fewer than 15 files.
- Avoid abbreviations.
- Use standard APIs as much as possible.
- Reuse. Write as little code as possible — logic two pages share belongs in a module under
  `composables/` or `data/`.
- Build the minimum working code, then iterate towards your goals.
- Don't add unnecessary dependencies unless required.
- **DO NOT ADD UNNECESSARY COMMENTS.** A comment earns its place only where the code cannot
  speak for itself: a one-line note on what the file does, and a constraint a reader would
  otherwise undo — a framework quirk, a build-time gotcha, a paint-order trap. Never narrate
  the next line, restate a name, explain a feature, or record history and rationale.
  Three hard limits, so this stays a rule and not a judgement call: **two lines maximum**
  (a third line means it is an explanation — put it in the commit message), **one summary
  line per docstring** (no rationale paragraphs, no "why not X"), and **no commented-out
  code**. Watch for the phrase **"rather than"** — it is the signature of justifying your
  choice against an alternative you did not take.

## Formatting

Prettier reads this folder's own `.prettierrc.json`: two-space indent, single quotes, no
semicolons. Never point it at `frontend/`'s config — running prettier with no config at all
rewrites the tree to double quotes and semicolons.

## Frontend

- Rely on `frappe-ui` components instead of building them from scratch. The `@framework/ui`
  controls (Filter, SortBy, QuickFilter, ColumnSettings) ship their own wire helpers — reuse
  them rather than re-deriving operator/column tables.
- Use Tailwind and espresso tokens. Avoid raw CSS (`<style>` blocks) unless genuinely
  unreachable from classes — `:deep()` overrides of a molecule's `:where()` rules qualify;
  `@apply` of plain utilities does not.
- **No Pinia.** Shared state is a module-scope ref in `data/` (see `data/session.ts`); anything
  else is local to the component or the composable. Use VueUse for common composition
  utilities.
- State stays in the controls' native shapes (`FilterCondition[]`, `Sort[]`, `Column[]`); this
  app translates to the wire in one place.
- Logic worth testing belongs in a plain module beside a `tests/` folder, not inside a `.vue`
  file: nothing here can mount a component, since `@vue/test-utils` is not installed.

## Data fetching

- Use `createResource` / `createListResource` / `call` from frappe-ui. Handle loading, error
  and success states explicitly.
- Resources read their route params once, at page setup. `App.vue` keys `<router-view>` on
  `route.path` so a path change remounts the page; the key excludes the query because
  saved-view tweaks rewrite it.

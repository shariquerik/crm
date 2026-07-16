# CRM on Studio — Agent Context

`crm_studio/` is the CRM frontend authored as a Studio app: pages built in the Studio
builder, page scripts and custom Vue components written on disk.

## Source of truth

**`crm_studio/` is the source of truth, and it is hand-edited.** Studio writes it on every
builder save (`is_standard` + `frappe_app = crm`), git tracks it, and `sync_studio_apps()`
re-imports it on `bench migrate`. There is no seed script — the Python seeders that once held
this role are deleted.

- `studio_page/<page>/<page>.json` — the blocks, authored in the builder.
- `studio_page/<page>/<page>.ts` — the page script, edited on disk. A standard app's page
  script lives in the file, not in the page's `script` field; `export_page()` excludes it.
- Editing a `.vue` component changes no Studio document, so nothing rebuilds on its own —
  Publish to regenerate the bundle.

`@app/*` resolves to `crm_studio/*` (vite's `studioRootAlias`), so page scripts and components
share modules rather than copying them.

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
- Reuse. Write as little code as possible — a page script that duplicates another's logic
  belongs in a shared module under `composables/` or `data/`.
- Build the minimum working code, then iterate towards your goals.
- Don't add unnecessary dependencies unless required.
- **DO NOT ADD UNNECESSARY COMMENTS.** A comment earns its place only where the code cannot
  speak for itself: a short file-level note on what the file does, and a constraint a reader
  would otherwise undo — a framework quirk, a build-time gotcha, a paint-order trap. Never
  narrate the next line, restate a name, explain a feature, or record history and rationale;
  those belong in the commit message.

## Formatting

Prettier and ESLint run over `crm_studio/` on pre-commit, using the crm repo's own configs
(`.prettierrc.json` at the repo root, `frontend/eslint.config.mjs`) — the same style as
`frontend/`: two-space indent, single quotes, no semicolons. Studio's own tabs-and-double-quotes
style does not apply here. `studio_page/*/*.json` is excluded: the builder writes it at
`json.dumps(indent=1)` and prettier would fight it on every save.

## Frontend

- Rely on `frappe-ui` components instead of building them from scratch. The `@framework/ui`
  controls (Filter, SortBy, QuickFilter, ColumnSettings) ship their own wire helpers — reuse
  them rather than re-deriving operator/column tables.
- Use Tailwind and espresso tokens. Avoid raw CSS (`<style>` blocks) unless genuinely
  unreachable from classes — `:deep()` overrides of a molecule's `:where()` rules qualify;
  `@apply` of plain utilities does not.
- **No Pinia.** Shared state is a module-scope ref in `data/` (see `data/session.ts`); anything
  else is local to the component or the page script. Use VueUse for common composition
  utilities.
- State stays in the controls' native shapes (`FilterCondition[]`, `Sort[]`, `Column[]`); this
  app translates to the wire in one place.
- Page state lives in the page script as plain refs, returned from `setup()` — not in Studio's
  Variables panel. A returned ref binds exactly as a panel variable does. Two constraints: the
  binding must be a REF (a plain object bound with v-model writes to a phantom variable), and a
  resource's creation params can't see script bindings — they see the variables map and
  route/router alone.

## Data fetching

- Use `createResource` / `createListResource` / `call` from frappe-ui. Handle loading, error
  and success states explicitly.
- Resources live on `ctx` — Studio owns their lifecycle.

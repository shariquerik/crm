# CRM on Studio — Agent Context

`crm_studio/` is the CRM frontend authored as a Studio app: pages built in the Studio
builder, page scripts and custom Vue components written on disk.

## Source of truth

**`crm_studio/` is hand-edited and is the source of truth.** Studio rewrites it on every builder
save (`is_standard` + `frappe_app = crm`), git tracks it, and `sync_studio_apps()` re-imports it.
There is no seed script.

- `studio_page/<page>/<page>.json` — a page's blocks.
- `studio_page/<page>/<page>.ts` — its page script. A standard app keeps the script in this file,
  not in the page's `script` field; `export_page()` excludes it.
- `studio_components/<component>.json` — a block tree shared by several pages, referenced by a
  block with `isStudioComponent`. `list` and `saved_view` are one screen on two routes, so both
  are a thin reference to `crm_list_body`.
- Editing a `.vue` component changes no Studio document — Publish to rebuild the bundle.

`@app/*` resolves to `crm_studio/*` (vite's `studioRootAlias`), so page scripts and components
share modules rather than copying them.

A referenced component still resolves `{{ … }}` and `$type: variable` against the **host page's**
script, but its usage-site `componentSlots` are dropped — vary behaviour per page with a
`visibilityCondition` the page script owns, not with slotted content.

### Blocks on disk

`crm_studio/tools/blocks.py` reads the trees; don't hand-roll a walker.

```
python crm_studio/tools/blocks.py dump saved_view    # component tree
python crm_studio/tools/blocks.py find saved_view list-modified
python crm_studio/tools/blocks.py diff saved_view    # blocks vs draft_blocks
```

- Blocks nest through `children` **and** `componentSlots.<slot>.slotContent` — the page header
  lives in the app shell's `header` slot, so walking `children` alone misses it.
- `draft_blocks` holds unpublished builder edits and **the builder renders it over `blocks`**, so
  a hand-edit made under a stale draft is invisible. An exported page omits the key;
  `BlockTree.save()` drops it, and the `blocks.py check` pre-commit hook rejects a commit
  carrying one.

## Running locally

Disk changes are not live until they are imported. Keep the watcher running:

```
bench --site <site> watch-studio
```

It imports changed `studio/**/*.json` and broadcasts `studio_doc_update`, so open previews refresh
themselves. Only `.json` is watched — a page's `.ts` hot-reloads through vite. One-shot
equivalent: `bench --site <site> execute studio.sync.sync_studio_apps --kwargs
"{'app_name':'crm'}"`. `bench migrate` is never needed for this.

Ports vary per bench; read them from the Procfile or the running processes.

- **Verify on the dev preview**, on the bench's port: `/dev/crm-studio/<Doctype>`, or
  `/dev/crm-studio/<Doctype>/view/<id>` for a saved view.
- The builder is on the Studio frontend's vite port, at `/studio/app/crm-studio/<pageID>`, where
  **`<pageID>` is the page's DB name, not its file name** — `studio_page/list/list.json` is
  `crm-list`. A wrong ID hangs on `Loading…` rather than erroring.

When a Studio screen hangs or renders blank, read the **network requests** before the console:
Frappe's console errors are minified and generic, while the failing request names the record.

`sync_studio_apps()` treats every directory under `studio/` as a Studio app, so tooling and notes
belong inside `crm_studio/`, not beside it.

## Tests

Vitest files live in a `tests/` folder beside the code they cover (`components/tests/`), and run
from the crm frontend workspace — the only place vitest is installed:

```
cd ../frontend && yarn test:studio
```

Logic worth testing belongs in a plain module the component imports (see
`components/shellChrome.ts`), not inside a `.vue` file: nothing here can mount a component,
since `@vue/test-utils` is not installed.

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
  speak for itself: a one-line note on what the file does, and a constraint a reader would
  otherwise undo — a framework quirk, a build-time gotcha, a paint-order trap. Never narrate
  the next line, restate a name, explain a feature, or record history and rationale.
  Three hard limits, so this stays a rule and not a judgement call: **two lines maximum**
  (a third line means it is an explanation — put it in the commit message), **one summary
  line per docstring** (no rationale paragraphs, no "why not X"), and **no commented-out
  code**. Watch for the phrase **"rather than"** — it is the signature of justifying your
  choice against an alternative you did not take.

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

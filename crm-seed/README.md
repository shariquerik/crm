# crm-seed

Seed scripts for the CRM-on-Studio app. **These scripts are the source of truth**
(docs/adr/0003): the Studio builder is for inspecting, and the JSON exported under
`apps/crm/studio/crm_studio/` is a generated artifact — never hand-edit it.

To change the app: edit a seeder, re-run, re-export. Never click it in the builder.

## Running

From the bench root (not via `bench execute` — the folder name is hyphenated, so it
isn't importable):

```bash
env/bin/python apps/crm/crm-seed/seed.py                  # seed everything, then vite-build
env/bin/python apps/crm/crm-seed/seed.py --page crm-list  # re-seed ONE page (no pruning)
env/bin/python apps/crm/crm-seed/seed.py --no-build       # skip the slow vite build
env/bin/python apps/crm/crm-seed/seed.py --list           # what this suite owns
env/bin/python apps/crm/crm-seed/test_seed.py             # tests (idempotency, publish, export)
```

Re-running is a no-op when nothing changed — every step diffs before it writes.

## Layout

| file | role |
|---|---|
| `config.py` | app identity + the **one** slug↔doctype map (`crm-lead` ↔ `CRM Lead`) |
| `blocks.py` | block-tree helpers: `root`, `block`, `container`, `bind`, `studio_component`, `custom_component` |
| `studio_docs.py` | idempotent upserts for Studio App / Page / Component; publish; build |
| `ui_customization.py` | the `CRM UI Customization` "App Sidebar" record, built from `config.DOCTYPES` |
| `pages/*.py` | one file per Studio Page — **auto-discovered** |
| `components/*.py` | one file per Studio Component — **auto-discovered** |

### The one hand-written file OUTSIDE this folder

`apps/crm/studio/crm_studio/` is generated — with a single exception, which is **source**:

| file | role |
|---|---|
| `components/CrmListView.vue` | custom Vue SFC: frappe-ui's ListView, with the column-resize event, the selection and the select banner's actions slot opened up (a block can reach none of the three). Edit it by hand; nothing regenerates it. |

A `.vue` anywhere under `apps/crm/studio/<studio_app>/` is discovered by
`studio.api.get_custom_vue_components` (by FILENAME → component name) and registered into the app
bundle by the build. Use it from a seeder with `blocks.custom_component("CrmListView", ...)` — the
block must carry `isCustomVueComponent`, or the build drops it as an unknown component.

This is the supported way past a frappe-ui component's limits (an event it never re-emits, state it
won't let you write, a slot it renders internally). Reach for it **before** driving a component from
the DOM in a page script.

## Adding a page

Drop a file in `pages/`. No registry to edit.

```python
import blocks

PAGE_NAME = "crm-list"          # Studio Page docname

def build() -> dict:
    return {
        "page_name": PAGE_NAME,
        "page_title": "List",           # must be unique among published pages
        "route": "/:doctype",           # a vue-router path; params read as {{ route.params.doctype }}
        "blocks": blocks.root([...]),
        "resources": [...],             # Studio Page Resource child rows
        "variables": [...],             # {"variable_name", "variable_type", "initial_value"}
        "script": "",                   # page script (JS)
    }
```

## Things that will bite you

- **Resource params evaluate ONCE**, at resource-creation time, against a narrow
  context of `{variables, route, router}` — not other resources, not page-script
  bindings. Route params work; reactive refetching does not. To refetch when state
  changes, `watch` the variable in the page script and call `.submit()`/`.reload()`
  on the resource.
- **Two-way binding is how the controls work.** `blocks.bind("filters")` emits
  `{"$type": "variable", "name": "filters"}`; Studio reads the variable for the prop
  and writes back on `update:<prop>` — exactly what a Vue `defineModel` emits. Point
  two controls at the **same variable** and they share state (that is ADR-0005's
  shared-ref model, e.g. Filter ↔ QuickFilter).
- **@framework/ui controls are controlled and meta-driven**: they take `:doctype`
  plus a `v-model`, never fetch, never persist. Studio's registry declares no props
  or emits for them — bind them yourself via `componentProps`.
- **Page scripts for a standard app live in `<page>.ts`** and are loaded from the
  vite bundle, so a script change only takes effect **after a build**. `seed.py` does
  this for you; `--no-build` skips it.
- **String and Object variables are JSON-parsed at runtime** — `studio_docs` encodes
  `initial_value` for you; pass real Python values.
- Page **titles and routes must be unique** among published pages, or `publish()`
  throws.

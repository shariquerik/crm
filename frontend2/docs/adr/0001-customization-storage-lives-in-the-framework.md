# Customization storage lives in the framework, split by shape

The record page has to be customizable along three axes — which tabs it shows, which fields
the detail panel shows, and what custom actions and components the header carries — and CRM
already stores the field axis in its own `CRM Fields Layout` (`dt + type + JSON`). We decided
against one generic customization doctype and instead split storage by the *shape* of the
thing being customized, with the first two living in frappe rather than CRM: ordered,
per-user-overridable item lists go to `Navigation` (already in `frappe/desk`), field
arrangement goes to a new framework Form Layout doctype consumed by `@framework/ui`'s
`FormLayout`, and imperative behaviour stays host-owned, feeding the framework's existing
`applyMetaScript` seam as `MetaOp[]`.

## Considered options

A single `target + type + user + JSON` table was the tempting answer, and is close to what
`CRM Fields Layout` already is. It was rejected because the only thing it can enforce is
"keyed by a doctype and a name": ordering, per-user overrides, permissions and validation all
have to be reimplemented inside each payload, and no editor UI can be shared across payloads
that have nothing in common. `Navigation Section` already carries `sequence`, `hidden`, `user`
and `overrides` in its schema, with an editor dialog on top.

## Consequences

`FormLayout` currently declines to own storage on purpose — `useScriptedLayout` states that
the lib references no app-specific doctype and fetches no script, and that the caller supplies
the `ops`. This decision reverses that stance for layouts while keeping it for scripts, so a
reader of that module will find a doctype where the docstring says there is none.

`NavigationScope` gains a third key, `surface` (`""` for a doctype's sidebar, `"record"` for
its detail tabs). Without it a doctype's sidebar sections and its tab sections share one scope,
separated only by a section name the sidebar editor can rename or delete.

Both changes land in frappe, deepening frontend2's existing dependency on a frappe branch
carrying `Navigation`, `SavedViews` and `IconPicker`.

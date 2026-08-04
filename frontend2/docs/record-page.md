# Record page — settled shape

What `/:doctype/:id` should be, for any doctype. Vocabulary is in [CONTEXT.md](../CONTEXT.md);
storage is in [ADR 0001](adr/0001-customization-storage-lives-in-the-framework.md). The
prototype at `src/pages/prototypes/generic/` renders all of this against a mocked Contact.

## Layout

```
┌────────────────────────────────────────────────┬───────────────┐
│ Contacts › Emma Chen                 assignees · Save          │
├────────────────────────────────────────────────┼───────────────┤
│ Activity · Emails · Files · Details            ║ avatar, title │
│                                                ║ tags          │
│   feed, centred in a max-w-3xl column          ║ quick actions │
│                                                ║ ───────────── │
│                                                ║ Name       ⊞  │
│   [ Reply to Emma Chen ]                  ↑    ║ Contact Deta… │
└────────────────────────────────────────────────┴───────────────┘
                                                 ↑ drag to resize
```

## Decisions

**The header carries state, not verbs.** Breadcrumb, assignees, Save. Every action on the record
lives in the panel. No status control: a generic record page cannot know which field is the
status, and nominating one is layout work — so the header writes nothing to the doc.

**Saving is explicit.** The panel and the Details tab edit one doc and share one dirty state;
`Save` sits where `Detail.vue` already puts it, and only while that state is dirty — a clean
record has nothing to save, so the header carries no dead control. Read-only fields never dirty
it.

**The full form is a tab, not a mode.** `Details` renders `FormLayout` over the same layout the
panel renders — i.e. `Detail.vue`'s body. An expand/collapse mode was built and dropped: it
hid the panel's actions at the moment it took over the screen, and its toggle had no honest
home. Default tabs are Activity, Emails, Files, Details; CRM adds calls, tasks and notes for
`CRM Lead` / `CRM Deal`.

**The panel holds every field**, in collapsible sections, so there is no "show all fields"
dialog. Section headers stay pinned while their fields scroll; the identity block never scrolls;
the chevron sits after the section title and appears on hover; no field counts.

**Quick actions are the doctype's to configure**, so nothing structural may sit in the strip —
this is why the Details control ended up on the first section header instead. `⋯` is the
strip's overflow, holding Follow, Copy link, Copy ID, Duplicate, Delete. Delete is not a quick
action: irreversible, and it sat next to Attach. Print and Share are.

**The panel collapses to a rail**, never to nothing — the rail shows the same quick actions
vertically, from one component, so a doctype's configured actions follow it in. The seam owns
every affordance: `w-resize` cursor, click to toggle, drag to resize (320–640px), collapse
below 260px, reopen on a 40px drag back, and the shell's round chevron on hover. No collapse
control in the header — a toggle cannot live inside the thing it hides.

**Followers and shared-with get no permanent surface**; the Share dialog displays them. Only
assignment holds header space.

**Document chrome comes from one source** — `frappe.desk.form.load.getdoc`'s `docinfo`
(assignment, tags, share, follow, attachments). Not layout-configurable.

**The composer floats over the feed**, no divider, in a bottom band it shares with the scroll
button. Collapsed it is three 36px controls: a pill that opens the editor in **Reply**, a round
button that opens it in **Comment**, and `+` for a menu of one create action per tab kind
(Attach a file, Make a call, Create a task, Write a note) — so the tabs a doctype shows decide
what that menu holds. Expanded: author, editor, tool row, Discard and Submit. Which of the two
it is was already said by the control that opened it, so there is no mode switch inside — the
placeholder and the envelope carry that.

**Reply** puts the subject on the composer's top line, where a comment shows its author, and the
recipients under it. Both are prefilled from the record. Cc and Bcc are buttons in that same top
line, not fields in the envelope — they are chrome, and most replies want neither. Each toggles its row and clears it on the way out, since a row
switched off has to mean nobody is copied rather than recipients out of sight. A comment has no
envelope, so the whole block belongs to the mode, not to the composer.

**One scroll button, never two.** It swaps at the feed's halfway point — `↓` above it, `↑`
below — hides when the feed does not overflow, and sits in the band's right gutter aligned to
the composer's bottom edge. The feed itself is a centred `max-w-3xl` column, not full width,
and carries no heading or New button: the tab strip already names the view.

**Nothing scrolls to a hard edge.** Wherever content passes under something — the composer
band, the tab strip, a stuck section header — it fades out over that seam and the fade appears
only while there is more to scroll (`useScrollEdges`, the same shape gameplan's editor uses).
The panel's fade belongs to the section header itself: its background is a gradient whose last
fifth ramps to transparent, so the fade rides with the stack and no overlay has to guess a
header's height.

**Section headers stack, they do not hand over.** Every header stays pinned, each below the ones
before it, so however deep the panel is scrolled every section is still one click from the top.
That costs two things. Headers and fields must be siblings rather than each section owning a
`<section>` box — a sticky header cannot outlive its containing block, and a section box ends at
the section — and the header height must be fixed (42px) for the offsets to be knowable without
measuring. Pitch is that height exactly, so headers stack flush and their labels sit evenly; the
fade is a tail hanging below the box into the fields' top padding, where it is invisible at rest
and covered by the next header once the stack closes up. The divider rides on a header's top
edge, not the previous section's bottom, since that is the line still visible once stacked.

**The panel animates its width open and shut**, `transition-[width] duration-300`, the same as
the sidebar. So it is one `aside` whose width changes between the panel and a 48px rail, not two
that swap, and the seam reports its drag so a resize does not animate behind the pointer.

**The panel's own state is preference, not customization**, so all of it sits in `localStorage`
and none of it reaches the server. Width and the collapsed flag are one pair for every doctype —
they track the reader's window, not the record — and must be readable at first paint, or a
transitioned width visibly jumps on every load. Which sections are open is per doctype, and
stores only what diverges from the layout's own `opened`, keyed by section name, so an admin
changing a default still reaches everyone who never disagreed with it. On a doctype with no saved
layout the generated section names change per request, so nothing persists and the defaults win
each load — the panel would rather do nothing than open the wrong section. A `usePanelState`
composable holds all three; `PanelLayout` is handed the effective open state and never sees a
width.

## What this needs from the framework

One layout resolver feeds both surfaces, but they render differently, so each surface gets its
own UI layer over the same composables:

- The **Details tab** is `FormLayout` unchanged — label above field, as `Detail.vue` renders it.
- The **panel** is `PanelLayout`, a new sibling of `FormLayout` in `@framework/ui` — label left,
  field right, in a `130px / 1fr` grid. `FormLayout` is untouched, and no dense single-column
  mode is needed: the two are permanently different surfaces, not one surface at two densities.

`PanelLayout` writes no logic of its own. `resolveLayout` bakes `depends_on`,
`useFieldTypes().resolve` returns a fieldtype's control, `formatField` renders its display value,
and every control takes `{ field, modelValue }` and emits `update:modelValue`. All four are
already public exports of `@framework/ui/FormLayout`.

Also required, from ADR 0001: the framework Form Layout doctype, `surface` on
`NavigationScope`, and the script/registry seam (`registerRecordComponent`).

Four traps this app hit while building the above:

- `Tooltip` sets `inheritAttrs: false` and never rebinds `$attrs`, so putting one directly
  inside a `Dropdown` trigger swallows the trigger's handlers and the menu stops opening. Wrap
  the tooltipped button in an element that takes the trigger props — and give that element a
  box, since a `display: contents` wrapper measures as zero and anchors the menu at 0,0.
- `bg-surface-white` is not generated in this app's Tailwind build. It fails silently, leaving
  floating surfaces transparent. Use `bg-surface-base`.
- A `Dialog`'s overlay carries `z-index: auto`, so any page layer with a positive z-index —
  the composer band at `z-10`, the seam at `z-20` — paints over it and stays lit while the rest
  of the page dims. `isolate` on the page's root container keeps those layers in their own
  stacking context.
- `Dialog` gives initial focus to its first tabbable element, which is the close button, so it
  opens wearing a focus ring. Mark the field you want focused `autofocus`; the dialog checks for
  it in `open-auto-focus` and stands down. Racing it with a `setTimeout` does not work.

## Open

- Tab order: `Details` is currently last, after Files. Configurable per doctype either way.
- Where Lead and Deal customization lands now that configuring a doctype is "order these tabs,
  open these sections" rather than authoring a layout tree.

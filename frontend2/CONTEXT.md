# CRM frontend2

The second CRM frontend. This glossary covers the record page and the two ways it can be
changed without editing its source.

## Language

**Record page**:
The page for one document of any doctype, served at `/:doctype/:id`. Not specific to deals or
leads.
_Avoid_: Detail page, form page

**Layout**:
Stored, declarative page configuration a user can edit from the UI. Tabs are one layout,
side panel fields are another.
_Avoid_: Customization, configuration, settings

**Script**:
Imperative extension of a record page, stored in the database or shipped in a file, that adds
actions and components rather than rearranging what is already there.
_Avoid_: Customization, plugin

**Tab**:
One entry in the record page's content switcher, and the content it shows — Activity, Emails,
Calls. Stored as a `Navigation Item` whose `type` names its content.

**Tab kind**:
What a tab's `type` names — the component that renders it and the create action it contributes
to the composer's `+` menu. Several tabs can share one kind; the kind reads their differences
off the stored `Navigation Item`.
_Avoid_: Tab type (the stored field, not the thing it names)

**Side panel**:
The right-hand column of the record page: the record's headline, its quick actions, and every
field, in collapsible sections. Constant across tabs; the headline does not scroll.
_Avoid_: Right panel, detail panel, sidebar

**Section**:
A titled, collapsible group of fields inside the side panel. Same `Section[]` the form renders,
laid out in one column.

**Details tab**:
The tab showing the doctype's full form — `FormLayout` over the same layout the side panel
renders, which is what `Detail.vue` shows today.
_Avoid_: Full form, expanded mode

**Quick actions**:
The row of record verbs under the headline, ending in an overflow menu. Configurable per
doctype, so nothing structural may occupy it.
_Avoid_: Action strip, toolbar

**Surface**:
Which part of an app a `Navigation` scope belongs to — a doctype's sidebar, or its record
page's tabs. The third key of a navigation scope, after app and doctype.

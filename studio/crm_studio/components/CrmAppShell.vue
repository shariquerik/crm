<!--
  CrmAppShell — the app chrome for a CRM page, built on frappe-ui's Gameplan layout
  primitives (DesktopShell / Rail / Sidebar / PageHeader / ScrollArea). These ship in the
  bench's frappe-ui but Studio registers none of them as blocks, so the only way to lay a
  page out with them is a custom Vue SFC — the same escape hatch CrmListView uses. It is
  discovered by `studio.api.get_custom_vue_components` and registered as `app.component(
  "CrmAppShell", ...)`; a block must carry `isCustomVueComponent: true` to resolve it.

  The shell owns three independent-scrolling regions and the pinned top bar; the PAGE owns
  what goes in them:
    - the RAIL (50px icon column) leads with the CRM app mark (a bespoke logo button, like
      gameplan's — not a RailItem: it's the app icon, has no tooltip, and its active/raised
      treatment differs), then the doctype switcher, one RailItem per `railItems` entry, the
      active one highlighted from `activeDoctype`. The switcher's inter-item GAP lives on a
      wrapper div, NOT on Rail: Rail is a bare flex column and frappe-ui leaves item spacing
      to the consumer (its own DesktopShell story wraps the switcher the same way);
    - the SIDEBAR (fixed 14rem) lists the active doctype's saved `views` under a "Views"
      label, its own ScrollArea so it scrolls apart from the table;
    - the `#header` slot is the toolbar, rendered into a PageHeader that TELEPORTS up to
      DesktopShell's pinned target (PageHeaderBase teleports to the target DesktopShell
      registers), so it stays put while the table scrolls under it;
    - the default slot is the island — the table, which brings its own ScrollArea.

  Two dividers, both mirroring gameplan's DesktopLayout:
    - RAIL ↔ SIDEBAR is a `border-r` on the Rail (gameplan draws it via `showBorder`). Rail
      and Sidebar share `bg-surface-sidebar`, so without this line they'd blend.
    - SIDEBAR ↔ CONTENT is the ISLAND's own edge — there is no border on the sidebar. The
      content region (`data-slot="desktop-shell-content"`) is themed in the scoped <style>
      below into a floating card: gameplan's exact `my-1 mr-1 rounded-lg bg-surface-base
      shadow-sm` (only top/bottom/right gutter — flush-left against the sidebar), with the
      dark-mode fallback to a left border since shadow doesn't read on dark. DesktopShell
      ships the slot flush by default and documents this theming as opt-in, so styling it is
      the intended path, not a hack. The pinned header teleports INTO this slot, so it rides
      inside the island too. The shell root gets `bg-surface-sidebar` so the rail, sidebar
      and the island's gutter read as one frame the card floats in — gameplan gets that
      backdrop from its global app body; we set it here since Studio hosts the page.

  Navigation is a click handler doing `router.push`, not a RouterLink `to`: the rest of the
  app routes with `router.push('/' + encodeURIComponent(doctype))`, and passing an
  already-encoded path to `to` would double-encode a doctype with a space ("CRM Deal").

  Editing this file changes no Studio document, so nothing rebuilds on its own — Publish to
  regenerate the bundle.
-->
<template>
	<DesktopShell :scroll="false" class="crm-desktop-shell">
		<template #rail>
			<!-- border-r is the rail↔sidebar divider (gameplan's showBorder). Both surfaces are
			     bg-surface-sidebar, so this line is what separates them. -->
			<Rail class="border-r border-outline-gray-1">
				<!-- The app mark. A bespoke button, not a RailItem — it's the CRM icon, has no
				     tooltip, and its raised active treatment (surface-base fill + shadow) differs
				     from the switcher tiles. Clicking it goes home. The logo is served by Frappe
				     at /assets/crm/ from crm/public/images. -->
				<div class="mb-3 flex shrink-0 items-center justify-center">
					<button
						type="button"
						class="flex size-7 items-center justify-center rounded-[7px] transition focus-visible:ring-0 focus-visible:focus-ring"
						:class="isHome ? 'bg-surface-base shadow-sm' : 'hover:opacity-90'"
						aria-label="CRM home"
						@click="go('/')"
					>
						<img
							:src="logoUrl"
							alt=""
							class="size-7 rounded-[7px]"
						/>
					</button>
				</div>

				<!-- The doctype switcher. The gap lives here, not on Rail (see header comment); flex-1
				     lets it eat the free space so the account avatar drops to the rail's foot, exactly
				     like gameplan's Rail (its own story pushes the "You" avatar down with a flex-1
				     middle). Items still sit top-aligned — flex-col starts them at the top. -->
				<div class="flex w-full flex-1 flex-col items-center gap-1">
					<RailItem
						v-for="item in railItems"
						:key="item.dt"
						:label="item.label"
						:icon="railIcon(item.dt)"
						:active="item.dt === activeDoctype"
						@click="go(`/${encodeSegment(item.dt)}`)"
					/>
				</div>

				<!-- The account menu, at the rail's foot like gameplan. A bespoke avatar button is the
				     trigger — not a RailItem: RailItem's root is a <Tooltip>, which can't forward reka's
				     as-child trigger ref (the same reason the app mark above is a bespoke button). Like
				     gameplan, the menu opens ABOVE the avatar, left-aligned (side="top" align="start"),
				     with the theme submenu flying out to the right; #item-suffix draws the active theme's
				     checkmark. The avatar gets NO ring/raised state on open — gameplan leaves it plain.
				     Holds Toggle theme + Log out for now — more entries can join `userMenuOptions`. -->
				<div class="mt-2 flex shrink-0 justify-center">
					<Dropdown :options="userMenuOptions" side="top" align="start">
						<template #default="{ open }">
							<button
								type="button"
								class="flex size-7 items-center justify-center rounded-full transition focus-visible:ring-0 focus-visible:focus-ring"
								:class="open ? '' : 'hover:opacity-90'"
								:aria-label="userLabel"
							>
								<Avatar
									:image="currentUser.user_image"
									:label="userLabel"
									size="md"
								/>
							</button>
						</template>
						<template #item-suffix="{ selected }">
							<span
								v-if="selected"
								class="lucide-check size-4 text-ink-gray-7"
								aria-hidden="true"
							/>
						</template>
					</Dropdown>
				</div>
			</Rail>
		</template>

		<template #sidebar>
			<!-- disableCollapse pins the width open: this app has no collapse toggle (the old
			     sidebarCollapsed/localStorage machinery is gone), so the sidebar is always 14rem.
			     No border here — the island's edge is the sidebar↔content divider. -->
			<!-- Sidebar's root is already `flex h-full flex-col`, so these stack directly as its
			     slot children (no wrapper) — the same shape as gameplan's AppSidebar. -->
			<Sidebar width="14rem" disableCollapse>
				<!-- App-level menu, gameplan's AppDropdown: a full-width button showing the app name
				     + chevron, opening the app menu. In its own p-2 cell (gameplan) so its box is
				     inset 8px, matching the views below. For now it holds only Settings; more entries
				     (Apps switcher, About, …) can join `appMenuOptions` later. -->
				<div class="flex shrink-0 items-center p-2">
					<Dropdown :options="appMenuOptions" placement="left-start" match-trigger-width>
						<template #default="{ open }">
							<button
								type="button"
								class="flex w-full min-w-0 items-center justify-between rounded px-2 py-1 text-ink-gray-7 transition"
								:class="open ? 'bg-surface-elevation-2 shadow-sm' : 'hover:bg-surface-gray-2'"
							>
								<span class="truncate text-lg-medium">{{ appName }}</span>
								<div class="grid size-7 place-content-center">
									<span
										class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5"
										aria-hidden="true"
									/>
								</div>
							</button>
						</template>
					</Dropdown>
				</div>
				<!-- The doctype label, pinned above the scroll. px-4 lands its text at the same 16px
				     inset as the dropdown's and the views' text (8px box inset + 8px inner padding). -->
				<div
					v-if="heading"
					class="flex h-7 shrink-0 items-center px-4 text-base font-medium text-ink-gray-8"
				>
					<span class="truncate">{{ heading }}</span>
				</div>
				<!-- The views scroller. Padding the VIEWPORT (not the ScrollArea) is what gives the
				     active row's rounded shadow room — otherwise the ScrollArea root's overflow-hidden
				     clips it flat against the edge. This is gameplan's exact fix. -->
				<ScrollArea class="min-h-0 flex-1" viewportClass="px-2 pt-0.5 pb-10">
					<SidebarLabel>Views</SidebarLabel>
					<SidebarItem
						v-for="view in views"
						:key="view.name"
						:label="view.label"
						:active="String(view.name) === activeView"
						:onClick="() => go(`/${encodeSegment(activeDoctype)}/view/${view.name}`)"
					/>
					<div v-if="!views.length" class="px-2 py-1 text-sm text-ink-gray-4">
						No saved views
					</div>
				</ScrollArea>
			</Sidebar>
		</template>

		<!-- The pinned top bar. PageHeader teleports to DesktopShell's target, so declaring it
		     here (inside the content area) still paints it above the scroll. -->
		<PageHeader class="shrink-0">
			<slot name="header" />
		</PageHeader>
		<!-- The island. flex-1/min-h-0 gives the table a bounded height to scroll within. -->
		<div class="flex min-h-0 flex-1 flex-col">
			<slot />
		</div>
	</DesktopShell>
</template>

<script setup lang="ts">
import {
	Avatar,
	DesktopShell,
	Dropdown,
	PageHeader,
	Rail,
	RailItem,
	ScrollArea,
	Sidebar,
	SidebarItem,
	SidebarLabel,
} from "frappe-ui"
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"

import { useAccountMenu } from "@app/composables/useAccountMenu"

withDefaults(
	defineProps<{
		/** The doctype switcher, one rail entry per item: `{ dt, label }`. `dt` is the doctype
		 *  name. The glyph is chosen by `railIcon` per doctype, not taken from the data. */
		railItems?: { dt: string; label: string }[]
		/** The route's doctype — its rail entry is highlighted. */
		activeDoctype?: string
		/** The active doctype's saved views: `{ name, label }[]`. */
		views?: { name: string | number; label: string }[]
		/** Shown at the top of the sidebar for context (the doctype's label). */
		heading?: string
		/** The product name shown in the sidebar's app-level dropdown trigger. */
		appName?: string
	}>(),
	{
		railItems: () => [],
		activeDoctype: "",
		views: () => [],
		heading: "",
		appName: "CRM",
	},
)

// The rail glyphs, curated to match CRM's own sidebar and keyed by doctype. Written as LITERAL
// `lucide-*` classes on purpose: frappe-ui registers lucide through a Tailwind matchComponents
// pack, so a class gets CSS only when its exact name appears in scanned source — a
// `lucide-${item.icon}` built from get_sidebar_layout's (Feather) icon name would compile to no
// rule and render blank. So the map is both the icon choice and the JIT safelist; the fallback is
// a literal too.
const RAIL_ICONS: Record<string, string> = {
	"CRM Lead": "lucide-users",
	"CRM Deal": "lucide-handshake",
	Contact: "lucide-contact-round",
	"CRM Organization": "lucide-building-2",
	"CRM Task": "lucide-list-checks",
	"FCRM Note": "lucide-notebook-pen",
}

function railIcon(doctype: string) {
	return RAIL_ICONS[doctype] ?? "lucide-file"
}

// A runtime-served URL, not a bundled asset — bound via :src so Vue's template compiler
// leaves it as a plain string instead of trying to resolve it as a build-time import (a
// static src="/assets/..." fails the Vite build). Frappe serves crm/public/images here.
const logoUrl = "/assets/crm/images/logo.svg"

const router = useRouter()
const route = useRoute()

// A saved view is active when the route names it (`/:doctype/view/:viewName`).
const activeView = computed(() => String(route.params.viewName ?? ""))

// The app-mark button raises when we're on the home page (the switcher's "nothing selected"
// landing), mirroring gameplan's logo-active-on-Home treatment.
const isHome = computed(() => route.path === "/")

function go(path: string) {
	router.push(path)
}

// The app-level menu. Just Settings for now (routes to the settings page — to be built);
// the array is the seam to grow into an Apps switcher, About, Clear cache, etc. like gameplan.
const appMenuOptions = [
	{
		icon: "lucide-settings",
		label: "Settings",
		onClick: () => go("/settings"),
	},
]

function encodeSegment(value: string) {
	return encodeURIComponent(value)
}

// The rail's account menu — the current user (for the avatar) and the dropdown options (Toggle
// theme + Log out). Session data and the theme/menu assembly live in `@app/data/session` and
// `@app/composables/useAccountMenu`; the shell just renders them. `loadCurrentUser` fills the
// avatar's name + image on mount (the email-initials fallback shows until then).
const { currentUser, userLabel, userMenuOptions, loadCurrentUser } = useAccountMenu()

onMounted(loadCurrentUser)
</script>

<style scoped>
/* The island — a floating rounded card in BOTH themes (Raven's dark-mode treatment). DesktopShell
   renders its content slot flush edge-to-edge by default and documents this as opt-in theming
   (style data-slot="desktop-shell-content" yourself), so this is the intended seam, not a hack. A
   top/bottom/right gutter (my-1 mr-1, no left) sits the card flush against the sidebar; its rounded
   edge is the sidebar↔content divider. :deep reaches the element inside DesktopShell; the
   .crm-desktop-shell prefix keeps it scoped to this shell.

   Surfaces follow Raven: the CHROME (rail + sidebar + gutter) is `surface-elevation-1`, and the
   ISLAND is `surface-base` — so in dark the island reads as #171717 recessed into the lighter
   #1f1f1f shell around it (the reverse of light, where the white island lifts off the gray-50
   frame with a shadow). Earlier we had these swapped, which either flattened the card
   (`dark:m-0`) or lit it the wrong way. Light keeps the shadow lift; dark drops it (shadows don't
   read on dark) and adds a hairline border so the recessed card still has a crisp edge — the way
   Raven frames its message pane in the dark chrome. */
.crm-desktop-shell :deep([data-slot="desktop-shell-content"]) {
	@apply my-1 mr-1 rounded-lg bg-surface-base shadow-sm dark:border dark:border-outline-gray-1 dark:shadow-none;
}

/* The frame the island sits in: rail, sidebar and the gutter around the card share one surface.
   Gameplan inherits this from its global app body; Studio hosts our page, so we set it on the
   shell root here. `surface-sidebar` handles light (#f8f8f8), but it is TRANSPARENT in dark —
   leaving the frame (and the transparent-in-dark Rail/Sidebar that sit on it) with no fill, so
   everything flattened onto one surface. `dark:bg-surface-elevation-1` gives the whole shell a
   solid #1f1f1f in dark — Raven's chrome surface — the lighter canvas the darker `surface-base`
   island (#171717) recesses into. */
.crm-desktop-shell {
	@apply bg-surface-sidebar dark:bg-surface-elevation-1;
}

/* The doctype switcher tiles, re-skinned for DARK only. RailItem's tile variant hardcodes a
   surface-gray-3 (#383838) fill with no glyph ink — in dark that's a heavy light box, its glyph
   left at an inherited/dim color, and its active state (gray-4 #424242) barely distinct from
   inactive. We keep the tile look but repaint it against the #1f1f1f chrome via RailItem's stable
   data-* hooks: inactive tiles recede to surface-gray-2 (#292929) with a muted ink-gray-6 glyph;
   the active tile lifts to surface-gray-4 (#424242) with a bright ink-gray-9 glyph. The
   [data-state="active"] rule carries one more attribute than the base, so it wins without
   !important; both out-specify RailItem's single-class utilities. Light mode is untouched. */
.crm-desktop-shell :deep([data-slot="rail-item"][data-variant="tile"]) {
	@apply dark:bg-surface-gray-2 dark:text-ink-gray-6;
}
.crm-desktop-shell :deep([data-slot="rail-item"][data-variant="tile"][data-state="active"]) {
	@apply dark:bg-surface-gray-4 dark:text-ink-gray-9;
}
</style>

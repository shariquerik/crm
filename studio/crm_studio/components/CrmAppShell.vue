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
    - the SIDEBAR (14rem, collapsible to nothing via the circular toggle straddling its outer
      edge) lists the active doctype's saved `views` under a "Views" label, its own ScrollArea
      so it scrolls apart from the table;
    - the `#header` slot is the toolbar, rendered into a PageHeader that TELEPORTS up to
      DesktopShell's pinned target (PageHeaderBase teleports to the target DesktopShell
      registers), so it stays put while the table scrolls under it;
    - the default slot is the island — the table, which brings its own ScrollArea.

  Two dividers, both mirroring gameplan's DesktopLayout:
    - RAIL ↔ SIDEBAR is a `border-l` on the SIDEBAR. Rail and Sidebar share
      `bg-surface-sidebar`, so without this line they'd blend. Gameplan draws it as the Rail's
      `border-r` (`showBorder`); ours hangs off the sidebar instead so it collapses with it —
      on a rail that outlives the sidebar, the line would be left dividing the rail from the
      island's gutter, which the island's own edge already separates.
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
	<!-- `relative` makes the shell root the containing block for the sidebar's collapse toggle. It
	     has to be an ANCESTOR of that button rather than the sidebar column it sits on: positioning
	     the column itself would make it paint over the island's shadow (see the toggle's comment). -->
	<DesktopShell :scroll="false" class="crm-desktop-shell relative">
		<template #rail>
			<!-- No border here: the rail↔sidebar divider is drawn by the SIDEBAR's border-l, so it
			     collapses along with it (see there). -->
			<!-- Tracking rail hover in JS, not CSS: while collapsed, hovering the rail reveals the
			     collapse toggle (the way back to the sidebar — see the toggle). The rail is the toggle's
			     SIBLING, not its ancestor, and a hover group only flows down to descendants, so
			     `group-hover` can't reach it. `:has()` on the shell root can't either — it'd fire on the
			     island too. Hence a ref. -->
			<Rail @mouseenter="railHovered = true" @mouseleave="railHovered = false">
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
				<div class="flex w-full flex-1 flex-col items-center gap-3">
					<RailItem
						v-for="item in railItems"
						:key="item.dt"
						:label="item.label"
						:icon="railIcon(item.dt)"
						:active="item.dt === activeDoctype"
						@click="go(`/${encodeSegment(item.dt)}`)"
					/>
				</div>

				<!-- Utility icons, above the avatar. `ghost`, not the switcher's `tile`: these are
				     actions, not destinations, and frappe-ui's ghost variant is its icon-button look
				     (transparent until hover) — the tiles would read as two more doctypes. gap-1 keeps
				     this cluster tighter than the switcher's gap-3 above, so the two groups stay
				     legible as separate things. -->
				<div class="flex w-full shrink-0 flex-col items-center gap-1">
					<RailItem
						label="Search"
						icon="lucide-search"
						variant="ghost"
						@click="openSearch"
					/>
					<RailItem
						label="Notifications"
						icon="lucide-bell"
						variant="ghost"
						:badge="unreadCount"
						badgeStyle="dot"
					/>
					<RailItem
						label="Help"
						icon="lucide-circle-help"
						variant="ghost"
						@click="openDocs"
					/>
					<RailItem
						label="Settings"
						icon="lucide-settings"
						variant="ghost"
						@click="go('/settings')"
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
			<!-- The sidebar column + its toggle. The wrapper exists ONLY to be the toggle's hover group:
			     the button reveals on hover of this whole column, so it has to live inside the element
			     being hovered. It stays a direct child of DesktopShell's root (this slot renders there),
			     which keeps the button outside the content region's overflow-hidden — that would shear
			     the circle in half. Deliberately not overflow-hidden itself: the button hangs outside this
			     box, past the right edge. It mirrors Sidebar's own root box (h-full, shrink-0) so the flex
			     row is unchanged.

			     Emphatically NOT `relative`, though it's the obvious home for the button's containing
			     block: that makes this column a POSITIONED element, which paints in a later step than its
			     in-flow siblings — so the sidebar would paint over the island and cover the shadow_sm
			     bleeding onto it from the island's left edge. The shell root carries the `relative`
			     instead; an ancestor gives the button the same containing block without reordering the
			     paint between this column and the island. -->
			<div class="group/sidebar flex h-full shrink-0">
				<!-- Collapses to ZERO width, not to an icon strip: the rail already is the icon-only
				     view of this nav, so frappe-ui's default 3rem collapsedWidth would just sit a second
				     dead column beside it. Sidebar animates the width itself (transition-[width] 300ms),
				     and its overflow-x-hidden clips the 14rem of content as it closes, so nothing here
				     needs a v-if. `collapsed` is driven by the floating toggle below.

				     border-l is the rail↔sidebar divider (gameplan draws it as the Rail's own border-r
				     via showBorder). It lives on the SIDEBAR, not the rail, so it belongs to the thing it
				     divides: collapsed, the rail abuts the island's gutter, and a rail-owned line would
				     hang there dividing nothing. Rail and Sidebar share bg-surface-sidebar, so this line
				     is what separates them while open. Transparent rather than dropped when collapsed
				     because a border-box element can't shrink its border below 1px — at width:0 the line
				     would still paint. Recoloring keeps the box the same 1px and just stops drawing it.
				     Only the LEFT edge: the island's own edge is the sidebar↔content divider. -->
				<!-- Sidebar's root is already `flex h-full flex-col`, so these stack directly as its
				     slot children (no wrapper) — the same shape as gameplan's AppSidebar. -->
				<Sidebar
					v-model:collapsed="collapsed"
					:width="SIDEBAR_WIDTH"
					collapsedWidth="0px"
					class="border-l"
					:class="collapsed ? 'border-transparent' : 'border-outline-gray-1'"
				>
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

				<!-- The seam hit-strip: an invisible 8px column centered on the sidebar↔island edge,
				     running the full height. It makes the whole edge the affordance the circle only hints
				     at — hovering anywhere on it swaps the cursor and (being inside the hover group) fades
				     the circle in; clicking it toggles, so you never have to hit the 24px circle itself.

				     Purely decorative in the a11y tree: aria-hidden, no tabindex, a div rather than a
				     button. It's a redundant pointer shortcut to the circle beside it, which stays the
				     real, focusable, labelled control — exposing both would just put two identical
				     controls in the tab order and the screen-reader output.

				     The cursor POINTS WHERE THE EDGE WILL GO: w-resize while open (clicking sends the seam
				     west, closing it), e-resize while collapsed (it comes back east). Both are single-
				     headed, so they read as a direction rather than `col-resize`'s double-headed "drag me
				     either way" — which would promise a drag-to-resize this edge doesn't do.

				     Absolutely positioned like the circle (same `left`, same containing block — the shell
				     root, NOT the column) and so also paints above the island, but it has no background,
				     so unlike a positioned column it hides no shadow. w-2 is a comfortable pointer target
				     that still leaves the island's own content clear — its rows are padded well past 4px. -->
				<div
					class="absolute inset-y-0 z-10 w-2 -translate-x-1/2 transition-[left] duration-300 ease-in-out"
					:class="collapsed ? 'cursor-e-resize' : 'cursor-w-resize'"
					:style="{ left: `calc(50px + ${collapsed ? '0px' : SIDEBAR_WIDTH})` }"
					aria-hidden="true"
					@click="collapsed = !collapsed"
				/>

				<!-- The collapse toggle: a circle straddling the sidebar↔island seam, near the foot.
				     NOT frappe-ui's SidebarCollapseToggle — that one is a SidebarItem, i.e. a labelled row
				     INSIDE the sidebar, which has nowhere to live once the sidebar is 0px wide (and would
				     be clipped by its overflow-x-hidden on the way out). So it's a bespoke button, which
				     is also why `collapsed` is a manual ref rather than Sidebar's provided toggle — that
				     only reaches its own subtree, and this sits outside it.

				     `left` is the seam, measured from the shell root — the containing block, since this
				     column can't be the one (see the wrapper above): the rail's fixed 50px plus whatever
				     the sidebar currently is (0 when collapsed). -translate-x-1/2 centers the circle on
				     that line, and the transition matches Sidebar's own width animation so the button
				     rides the edge instead of jumping. z-20 keeps it over the island's shadow AND over the
				     seam strip it overlaps, so pointing at the circle gives you the circle — its own
				     cursor-pointer, its own click — rather than the strip's resize cursor underneath.

				     `bottom-1/3` anchors it to the VIEWPORT — a third of the way up, translate-y-1/2 to
				     center it on that line — not to the rail's contents. That matters because COLLAPSED,
				     the sidebar is 0 and this seam becomes the rail's own right edge: the circle hangs
				     over the rail's 50px column and lands on whatever shares its height, and RailItem's
				     tooltips are placement="right", so they fly into this strip too. An earlier version
				     measured the rail's foot and floated just above it — correct, but it drifted with the
				     icon count and read as unmoored. A fraction of the viewport holds still.

				     The lower third specifically, because the rail is busy at BOTH ends and this is the
				     gap between them: the switcher grows DOWN from the top (278px at 6 tiles, 398px at 9
				     — `railItems` is server-driven, so treat it as unbounded) and the foot cluster grows
				     UP from the bottom (172px today). A third from the TOP sits inside the switcher at
				     every realistic window height; a third from the bottom clears both, and keeps the
				     low-and-right placement the design started from.

				     Always hidden until something is hovered, in both states — it's chrome, and the layout
				     shouldn't carry a permanent button for an occasional action. What reveals it differs:
				     EXPANDED, the sidebar column (the group), which is 14rem of easy target. COLLAPSED,
				     that column is a 1px sliver, so the RAIL takes over as the trigger — hence the extra
				     `railHovered` term, since a CSS group can't see a sibling. The seam strip keeps
				     working in both, and it's a child of the group, as is this button: pointing at either
				     one holds it open, so it never vanishes as you reach for it.

				     Opacity, not v-if, so it fades rather than pops and stays keyboard-reachable —
				     focus-visible:opacity-100 reveals it on tab, since a keyboard user trips no hover at
				     all. It keeps pointer events while transparent, which is what lets its own invisible
				     hit area (via the group) be one of the things that reveals it. -->
				<button
					type="button"
					class="absolute bottom-1/3 z-20 flex size-6 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-5 shadow-sm transition-[left,opacity,background-color] duration-300 ease-in-out hover:bg-surface-gray-2 focus-visible:opacity-100 focus-visible:focus-ring"
					:class="
						collapsed && railHovered
							? 'opacity-100'
							: 'opacity-0 group-hover/sidebar:opacity-100'
					"
					:style="{ left: `calc(50px + ${collapsed ? '0px' : SIDEBAR_WIDTH})` }"
					:aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
					:aria-expanded="!collapsed"
					@click="collapsed = !collapsed"
				>
					<span
						class="lucide-chevron-left size-4 transition-transform duration-300 ease-in-out"
						:class="{ 'rotate-180': collapsed }"
						aria-hidden="true"
					/>
				</button>
			</div>
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
import { computed, onMounted, ref } from "vue"
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

// The sidebar's open width, shared by Sidebar and the toggle button that tracks its edge — they
// must agree or the button drifts off the seam.
const SIDEBAR_WIDTH = "14rem"

// Sidebar open/closed, owned here rather than by Sidebar's own provided toggle (see the button's
// comment). Explicitly `false`, not Sidebar's default `null`: null means "unset", which makes it
// auto-collapse below the sm breakpoint — reasonable for a phone, but this shell is desktop-only
// and the table beside it needs the sidebar's state to be the user's choice alone. Not persisted:
// it resets to open each load.
const collapsed = ref(false)

// Whether the pointer is over the rail — the collapsed sidebar's reveal trigger for the toggle.
// State rather than a CSS hover group because the rail is the toggle's sibling; see the Rail.
const railHovered = ref(false)

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

// Help — the only rail-foot action with a real destination. CRM's own docs, opened in a new tab
// rather than routed: it leaves the app entirely, so it isn't the router's business. `noopener`
// because a plain target="_blank" hands the opened page a live `window.opener` back into ours.
const DOCS_URL = "https://docs.frappe.io/crm"

function openDocs() {
	window.open(DOCS_URL, "_blank", "noopener")
}

// STUB. Search has no UI yet — CRM's frontend has no command palette to borrow and Studio hosts no
// search of its own, so there is nothing to open. The rail entry exists to hold the slot (and its
// place in the foot's layout); wire this to a palette when one lands.
function openSearch() {}

// STUB. Hardcoded so the dot badge renders — nothing counts notifications yet. CRM's own sidebar
// gets this from `notificationsStore()` in its frontend, which Studio's bundle can't reach; this
// wants a resource of its own. Until then the dot is decoration, and it always shows.
const unreadCount = ref(3)

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

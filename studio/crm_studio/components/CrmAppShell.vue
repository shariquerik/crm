<!--
  CrmAppShell — the app chrome for a CRM page, built on frappe-ui's Gameplan layout
  primitives (DesktopShell / Rail / Sidebar / PageHeader / ScrollArea). These ship in the
  bench's frappe-ui but Studio registers none of them as blocks, so the only way to lay a
  page out with them is a custom Vue SFC — the same escape hatch CrmListView uses. It is
  discovered by `studio.api.get_custom_vue_components` and registered as `app.component(
  "CrmAppShell", ...)`; a block must carry `isCustomVueComponent: true` to resolve it.

  The shell owns three independent-scrolling regions and the pinned top bar; the PAGE owns
  what goes in them:
    - the RAIL (50px icon column) is the doctype switcher, one RailItem per `railItems`
      entry, the active one highlighted from `activeDoctype`;
    - the SIDEBAR (fixed 14rem) lists the active doctype's saved `views` under a "Views"
      label, its own ScrollArea so it scrolls apart from the table;
    - the `#header` slot is the toolbar, rendered into a PageHeader that TELEPORTS up to
      DesktopShell's pinned target (PageHeaderBase teleports to the target DesktopShell
      registers), so it stays put while the table scrolls under it;
    - the default slot is the island — the table, which brings its own ScrollArea.

  Navigation is a click handler doing `router.push`, not a RouterLink `to`: the rest of the
  app routes with `router.push('/' + encodeURIComponent(doctype))`, and passing an
  already-encoded path to `to` would double-encode a doctype with a space ("CRM Deal").

  Editing this file changes no Studio document, so nothing rebuilds on its own — Publish to
  regenerate the bundle.
-->
<template>
	<DesktopShell :scroll="false">
		<template #rail>
			<Rail>
				<RailItem
					v-for="item in railItems"
					:key="item.dt"
					:label="item.label"
					:icon="railIcon(item.dt)"
					:active="item.dt === activeDoctype"
					@click="go(`/${encodeSegment(item.dt)}`)"
				/>
			</Rail>
		</template>

		<template #sidebar>
			<!-- disableCollapse pins the width open: this app has no collapse toggle (the old
			     sidebarCollapsed/localStorage machinery is gone), so the sidebar is always 14rem. -->
			<Sidebar width="14rem" disableCollapse class="border-r border-outline-gray-1">
				<div class="flex h-full flex-col gap-2 p-2">
					<div
						v-if="heading"
						class="flex h-7 shrink-0 items-center px-2 text-base font-medium text-ink-gray-8"
					>
						<span class="truncate">{{ heading }}</span>
					</div>
					<ScrollArea class="min-h-0 flex-1">
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
				</div>
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
	DesktopShell,
	PageHeader,
	Rail,
	RailItem,
	ScrollArea,
	Sidebar,
	SidebarItem,
	SidebarLabel,
} from "frappe-ui"
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"

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
	}>(),
	{
		railItems: () => [],
		activeDoctype: "",
		views: () => [],
		heading: "",
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

const router = useRouter()
const route = useRoute()

// A saved view is active when the route names it (`/:doctype/view/:viewName`).
const activeView = computed(() => String(route.params.viewName ?? ""))

function go(path: string) {
	router.push(path)
}

function encodeSegment(value: string) {
	return encodeURIComponent(value)
}
</script>

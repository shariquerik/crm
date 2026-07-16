<!--
  CrmAppShell — the app chrome for a CRM page, built on frappe-ui's DesktopShell / Rail /
  Sidebar / PageHeader primitives. Studio registers none of them as blocks, so laying a page
  out with them needs a custom Vue SFC — the same escape hatch CrmListView uses. Discovered by
  `studio.api.get_custom_vue_components`; a block must carry `isCustomVueComponent: true`.

  The shell owns the rail, the sidebar and the pinned header; the page fills them via props
  and the `header`/default slots. Editing this file changes no Studio document, so nothing
  rebuilds on its own — Publish to regenerate the bundle.
-->
<template>
	<!-- `relative` here, not on the sidebar column: the collapse toggle needs an ancestor as its
	     containing block, and positioning the column itself would paint it over the island's shadow. -->
	<DesktopShell :scroll="false" class="crm-desktop-shell relative">
		<template #rail>
			<!-- Rail hover is tracked in JS because the rail is the toggle's SIBLING: a CSS hover
			     group only flows down to descendants, and `:has()` on the root would fire on the
			     island too. -->
			<Rail @mouseenter="railHovered = true" @mouseleave="railHovered = false">
				<!-- The app mark. Goes to the first module — there is no home screen — and so carries
				     no active treatment: wherever it lands, that module's own RailItem lights up. -->
				<div class="mb-3 flex shrink-0 items-center justify-center">
					<button
						type="button"
						class="flex size-7 items-center justify-center rounded-[7px] transition hover:opacity-90 focus-visible:ring-0 focus-visible:focus-ring"
						aria-label="Go to the first module"
						@click="goToFirstModule"
					>
						<img
							:src="logoUrl"
							alt=""
							class="size-7 rounded-[7px]"
						/>
					</button>
				</div>

				<!-- The doctype switcher. The gap lives on this wrapper, not on Rail, which is a bare
				     flex column that leaves item spacing to the consumer. flex-1 drops the avatar to
				     the rail's foot. -->
				<div class="flex w-full flex-1 flex-col items-center gap-3">
					<RailItem
						v-for="item in railItems"
						:key="item.dt"
						:label="item.label"
						:icon="doctypeIcon(item.dt)"
						:active="item.dt === activeDoctype"
						@click="go(`/${encodeSegment(item.dt)}`)"
					/>
				</div>

				<!-- Utility icons. `ghost`, not the switcher's `tile`: these are actions, not
				     destinations, and tiles would read as two more doctypes. -->
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

				<!-- A bespoke avatar button, not a RailItem: RailItem's root is a <Tooltip>, which
				     can't forward reka's as-child trigger ref. -->
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
			<!-- The toggle's hover group, so it must wrap what you hover. Deliberately NOT
			     `relative`: that would make this column a positioned element, painting it over the
			     island and covering the shadow bleeding off the island's left edge. -->
			<div class="group/sidebar flex h-full shrink-0">
				<!-- Collapses to ZERO width, not to an icon strip — the rail already is the icon-only
				     view of this nav. The border-l is the rail↔sidebar divider, hung on the sidebar so
				     it collapses with it rather than being left dividing nothing. Transparent rather
				     than dropped when collapsed: a border-box element can't shrink a border below 1px,
				     so at width:0 the line would still paint. -->
				<Sidebar
					v-model:collapsed="collapsed"
					:width="SIDEBAR_WIDTH"
					collapsedWidth="0px"
					class="border-l"
					:class="collapsed ? 'border-transparent' : 'border-outline-gray-1'"
				>
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
					<div
						v-if="heading"
						class="flex h-7 shrink-0 items-center px-4 text-base font-medium text-ink-gray-8"
					>
						<span class="truncate">{{ heading }}</span>
					</div>
					<!-- Padding the VIEWPORT, not the ScrollArea, is what gives the active row's
					     rounded shadow room — the root's overflow-hidden would clip it flat. -->
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

				<!-- An invisible hit-strip on the seam, so the whole edge toggles rather than just the
				     24px circle. aria-hidden and unfocusable: it is a redundant pointer shortcut to the
				     button beside it, which stays the real labelled control. The cursor points where
				     the edge will go — single-headed, so it doesn't promise a drag-to-resize. -->
				<div
					class="absolute inset-y-0 z-10 w-2 -translate-x-1/2 transition-[left] duration-300 ease-in-out"
					:class="collapsed ? 'cursor-e-resize' : 'cursor-w-resize'"
					:style="{ left: `calc(50px + ${collapsed ? '0px' : SIDEBAR_WIDTH})` }"
					aria-hidden="true"
					@click="collapsed = !collapsed"
				/>

				<!-- The collapse toggle, straddling the seam. Not frappe-ui's SidebarCollapseToggle:
				     that is a SidebarItem, which has nowhere to live once the sidebar is 0px wide.
				     `bottom-1/3` anchors it to the viewport rather than the rail's contents, which
				     drift with the (server-driven) icon count. Collapsed, the sidebar column is a 1px
				     sliver, so `railHovered` takes over as the reveal trigger. Opacity, not v-if, so
				     it stays keyboard-reachable. -->
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

		<!-- PageHeader teleports to DesktopShell's pinned target, so declaring it here still paints
		     it above the scroll. -->
		<PageHeader class="shrink-0">
			<slot name="header" />
		</PageHeader>
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
import { doctypeIcon } from "@app/data/doctypes"

const props = withDefaults(
	defineProps<{
		railItems?: { dt: string; label: string }[]
		activeDoctype?: string
		views?: { name: string | number; label: string }[]
		heading?: string
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

// Bound via :src, not a static src="", so Vue leaves it a plain string instead of resolving it
// as a build-time import (which fails the Vite build). Frappe serves crm/public/images here.
const logoUrl = "/assets/crm/images/logo.svg"

// Shared by Sidebar and the toggle that tracks its edge — they must agree or the button drifts.
const SIDEBAR_WIDTH = "14rem"

// Explicitly `false`, not Sidebar's default `null`: null means "unset", which auto-collapses
// below the sm breakpoint. This shell is desktop-only. Not persisted — resets to open each load.
const collapsed = ref(false)

const railHovered = ref(false)

const router = useRouter()
const route = useRoute()

const activeView = computed(() => String(route.params.viewName ?? ""))

function go(path: string) {
	router.push(path)
}

// Reads `railItems` rather than hard-coding a doctype, so a reordered sidebar moves it with no
// change here. That resource is [] until it lands; "/" is the redirector that picks the same
// first module once it does, so both paths end in one place.
function goToFirstModule() {
	const first = props.railItems[0]
	go(first ? `/${encodeSegment(first.dt)}` : "/")
}

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

const DOCS_URL = "https://docs.frappe.io/crm"

// `noopener` because a plain target="_blank" hands the opened page a live `window.opener`.
function openDocs() {
	window.open(DOCS_URL, "_blank", "noopener")
}

// STUB. No command palette exists to open yet.
function openSearch() {}

// STUB. Hardcoded so the dot renders — nothing counts notifications yet. CRM's own sidebar gets
// this from a store Studio's bundle can't reach; this wants a resource of its own.
const unreadCount = ref(3)

const { currentUser, userLabel, userMenuOptions, loadCurrentUser } = useAccountMenu()

onMounted(loadCurrentUser)
</script>

<style scoped>
/* DesktopShell renders its content slot flush edge-to-edge and documents styling
   data-slot="desktop-shell-content" as opt-in theming, so this is the intended seam, not a hack.
   The gutter (my-1 mr-1, no left) sits the card flush against the sidebar; its rounded edge IS
   the sidebar↔content divider.

   Surfaces: the chrome (rail + sidebar + gutter) is elevation-1 and the island is surface-base,
   so in dark the island reads as #171717 recessed into the lighter #1f1f1f around it — the
   reverse of light, where the white island lifts off the gray frame with a shadow. Dark drops
   the shadow (shadows don't read on dark) for a hairline border. */
.crm-desktop-shell :deep([data-slot="desktop-shell-content"]) {
	@apply my-1 mr-1 rounded-lg bg-surface-base shadow-sm dark:border dark:border-outline-gray-1 dark:shadow-none;
}

/* `surface-sidebar` handles light, but is TRANSPARENT in dark — leaving the frame and the
   transparent-in-dark Rail/Sidebar with no fill, flattening everything onto one surface. */
.crm-desktop-shell {
	@apply bg-surface-sidebar dark:bg-surface-elevation-1;
}

/* RailItem's tile variant hardcodes a surface-gray-3 fill with no glyph ink — in dark that is a
   heavy light box whose active state is barely distinct. Repainted here against the #1f1f1f
   chrome via RailItem's stable data-* hooks. The [data-state="active"] rule carries one more
   attribute than the base, so it wins without !important. Light mode is untouched. */
.crm-desktop-shell :deep([data-slot="rail-item"][data-variant="tile"]) {
	@apply dark:bg-surface-gray-2 dark:text-ink-gray-6;
}
.crm-desktop-shell :deep([data-slot="rail-item"][data-variant="tile"][data-state="active"]) {
	@apply dark:bg-surface-gray-4 dark:text-ink-gray-9;
}
</style>

<template>
  <DesktopShell :scroll="false" class="crm-desktop-shell relative">
    <template #rail>
      <Rail @mouseenter="railHovered = true" @mouseleave="railHovered = false">
        <div class="mb-3 flex shrink-0 items-center justify-center">
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-[7px] transition hover:opacity-90 focus-visible:ring-0 focus-visible:focus-ring"
            aria-label="Go to the first module"
            @click="goToFirstModule"
          >
            <img :src="LOGO_URL" alt="" class="size-7 rounded-[7px]" />
          </button>
        </div>

        <div class="flex w-full flex-1 flex-col items-center gap-3">
          <RailItem
            v-for="item in railItems"
            :key="item.name"
            :label="item.label"
            :active="isActiveRailItem(item, activeDoctype, route.path)"
            @click="openRailItem(item)"
          >
            <IconGlyph :name="doctypeIcon(item.dt, item.icon)" class="size-4" />
          </RailItem>
          <Tooltip
            v-if="chrome.unlistedDoctype"
            :text="`Add ${unlistedLabel} to sidebar`"
            placement="right"
          >
            <button
              type="button"
              class="relative flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-dashed border-outline-gray-3 text-ink-gray-5 transition hover:border-outline-gray-4 hover:text-ink-gray-8 focus-visible:ring-0 focus-visible:focus-ring"
              :aria-label="`Add ${unlistedLabel} to sidebar`"
              @click="addToRail(chrome.unlistedDoctype)"
            >
              <span
                class="absolute -left-[11px] top-1/2 h-7 w-1 -translate-y-1/2 rounded-r bg-surface-gray-8"
                aria-hidden="true"
              />
              <IconGlyph
                :name="doctypeIcon(chrome.unlistedDoctype)"
                class="size-4"
              />
            </button>
          </Tooltip>
        </div>

        <div class="flex w-full shrink-0 flex-col items-center gap-1">
          <RailItem
            label="Help"
            icon="lucide-circle-help"
            variant="ghost"
            @click="openDocs"
          />
          <RailItem
            label="Customize sidebar"
            icon="lucide-settings-2"
            variant="ghost"
            @click="editingRail = true"
          />
        </div>

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
      <div v-if="chrome.showSidebar" class="group/sidebar flex h-full shrink-0">
        <Sidebar
          v-model:collapsed="collapsed"
          :width="SIDEBAR_WIDTH"
          collapsedWidth="0px"
          class="border-l"
          :class="collapsed ? 'border-transparent' : 'border-outline-gray-1'"
        >
          <div class="flex shrink-0 items-center p-2">
            <Dropdown
              :options="appMenuOptions"
              placement="left-start"
              match-trigger-width
            >
              <template #default="{ open }">
                <button
                  type="button"
                  class="flex w-full min-w-0 items-center justify-between rounded px-2 py-1 text-ink-gray-7 transition"
                  :class="
                    open
                      ? 'bg-surface-elevation-2 shadow-sm'
                      : 'hover:bg-surface-gray-2'
                  "
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
          <ScrollArea
            class="min-h-0 flex-1 bg-inherit"
            viewportClass="flex flex-col bg-inherit px-2 pt-0.5 [&>div]:flex [&>div]:flex-1 [&>div]:flex-col [&>div]:bg-inherit"
          >
            <NavigationSidebar
              :doctype="activeDoctype"
              :app="APP_NAME"
              :activeView="activeView"
            />
          </ScrollArea>
        </Sidebar>

        <SidebarEdge
          :open="!collapsed"
          :offset="edgeOffset"
          :railHovered="railHovered"
          @toggle="collapsed = !collapsed"
        />
      </div>
    </template>

    <PageHeader v-if="chrome.showHeader && pageHeader" class="shrink-0">
      <component :is="pageHeader.slot" />
    </PageHeader>
    <div class="flex min-h-0 flex-1 flex-col">
      <slot />
    </div>

    <RailEditorDialog v-model="editingRail" />
    <SettingsDialog />
    <AboutDialog v-model="showAbout" />
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
  Tooltip,
} from 'frappe-ui'
import {
  IconGlyph,
  itemTarget,
  NavigationSidebar,
} from '@framework/ui/experimental'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'

import AboutDialog from '@/components/AboutDialog.vue'
import RailEditorDialog from '@/components/RailEditorDialog.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import SidebarEdge from '@/components/SidebarEdge.vue'
import { deriveShellChrome } from '@/components/shellChrome'
import { useAccountMenu } from '@/composables/useAccountMenu'
import { useAppMenu } from '@/composables/useAppMenu'
import { APP_NAME, LOGO_URL } from '@/data/apps'
import { doctypeIcon, doctypeLabel } from '@/data/doctypes'
import {
  isActiveRailItem,
  railDoctypes,
  type RailItem as RailEntry,
} from '@/data/rail'
import {
  addableDoctypes,
  addableDoctypeState,
  addToRail,
  placedRailItems,
  railItems,
} from '@/data/railLayout'
import { pageHeader } from '@/data/pageHeader'
import { currentUser, userLabel } from '@/data/session'

const appName = 'CRM'

const SIDEBAR_WIDTH = '14rem'

const collapsed = useLocalStorage('crm-sidebar-collapsed', false)

const railHovered = ref(false)

const edgeOffset = computed(
  () => `calc(50px + ${collapsed.value ? '0px' : SIDEBAR_WIDTH})`,
)

const editingRail = ref(false)

const router = useRouter()
const route = useRoute()

const activeDoctype = computed(() => (route.params.doctype as string) || '')

// A saved view is a route param on the list, and a query param on a record.
const activeView = computed(
  () => (route.params.viewName as string) || (route.query.view as string) || '',
)

function go(path: string) {
  router.push(path)
}

function openRailItem(item: RailEntry) {
  const target = itemTarget(item)
  if (!('leave' in target)) {
    go(target.path)
    return
  }
  if (item.new_tab) window.open(target.leave, '_blank', 'noopener')
  else window.location.assign(target.leave)
}

function goToFirstModule() {
  const first = railItems.value[0]
  if (first) openRailItem(first)
  else go('/')
}

const chrome = computed(() =>
  deriveShellChrome(
    activeDoctype.value,
    railDoctypes(placedRailItems.value),
    addableDoctypeState.value,
  ),
)

watchEffect(() => {
  if (chrome.value.needsAddableDoctypes && !addableDoctypes.loading) {
    addableDoctypes.fetch()
  }
})

const unlistedLabel = computed(() => doctypeLabel(chrome.value.unlistedDoctype))

const { appMenuOptions, showAbout, onKeydown } = useAppMenu()

const DOCS_URL = 'https://docs.frappe.io/crm'

function openDocs() {
  window.open(DOCS_URL, '_blank', 'noopener')
}

const { userMenuOptions } = useAccountMenu()

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.crm-desktop-shell :deep([data-slot='desktop-shell-content']) {
  @apply border-l border-outline-gray-1 bg-surface-base;
}

.crm-desktop-shell :deep([data-slot='rail-item'][data-variant='tile']) {
  @apply dark:bg-surface-gray-2 dark:text-ink-gray-6;
}
.crm-desktop-shell
  :deep([data-slot='rail-item'][data-variant='tile'][data-state='active']) {
  @apply dark:bg-surface-gray-4 dark:text-ink-gray-9;
}
</style>

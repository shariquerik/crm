<!-- PROTOTYPE — throwaway. -->
<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      class="flex shrink-0 items-center gap-5 border-b border-outline-gray-1"
      :class="compact ? 'px-4' : 'px-6'"
    >
      <button
        v-for="tab in shownTabs"
        :key="tab.name"
        type="button"
        class="flex items-center gap-2 border-b-2 py-3 transition"
        :class="[
          compact ? 'text-sm' : 'text-base',
          tab.name === activeTab
            ? 'border-outline-gray-8 text-ink-gray-8'
            : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
        ]"
        @click="activeTab = tab.name"
      >
        <span :class="[tab.icon, 'size-4']" aria-hidden="true" />
        {{ tab.label }}
      </button>

      <Button
        v-if="compact"
        class="ml-auto"
        icon="lucide-plus"
        variant="ghost"
      />
    </div>

    <div v-if="isForm" class="min-h-0 flex-1 overflow-y-auto px-6">
      <GenericForm />
    </div>

    <div v-else class="relative min-h-0 flex-1">
      <div
        ref="feed"
        class="h-full overflow-y-auto pb-24 pt-4"
        :class="compact ? 'px-4' : 'px-6'"
      >
        <div
          ref="feedContent"
          class="mx-auto flex w-full max-w-3xl flex-col"
          :class="compact ? 'gap-4' : 'gap-5'"
        >
          <div
            v-for="(item, index) in shownActivity"
            :key="index"
            class="flex gap-3"
          >
            <div class="flex w-6 shrink-0 justify-center pt-1">
              <Avatar v-if="item.kind !== 'log'" :label="item.who" size="sm" />
              <span
                v-else
                :class="[item.icon, 'size-4 text-ink-gray-5']"
                aria-hidden="true"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-base text-ink-gray-7">
                  <span class="font-medium text-ink-gray-9">{{
                    item.who
                  }}</span>
                  {{ item.what || 'sent an email' }}
                </p>
                <span class="shrink-0 text-sm text-ink-gray-5">{{
                  item.when
                }}</span>
              </div>

              <div
                v-if="item.kind === 'comment'"
                class="mt-2 rounded-lg bg-surface-gray-2 p-3 text-base text-ink-gray-8"
              >
                {{ item.body }}
              </div>

              <div
                v-else-if="item.kind === 'email'"
                class="mt-2 rounded-lg border border-outline-gray-2 p-3"
              >
                <p class="text-base font-medium text-ink-gray-9">
                  {{ item.subject }}
                </p>
                <p class="mt-0.5 text-sm text-ink-gray-5">To: {{ item.to }}</p>
                <p
                  v-if="!compact"
                  class="mt-3 whitespace-pre-line border-t border-outline-gray-1 pt-3 text-base text-ink-gray-8"
                >
                  {{ item.body }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface-base to-transparent transition-opacity"
        :class="atTop ? 'opacity-0' : 'opacity-100'"
      />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-base from-40% to-transparent transition-opacity"
        :class="atBottom ? 'opacity-0' : 'opacity-100'"
      />
    </div>

    <div
      v-if="!isForm"
      class="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-end gap-2 px-6"
    >
      <div class="flex-1" />

      <GenericComposer class="min-w-0" />

      <div class="flex flex-1 justify-end">
        <Tooltip
          v-if="overflowing"
          :text="pastHalf ? 'Scroll to top' : 'Scroll to bottom'"
          placement="top"
        >
          <button
            type="button"
            class="pointer-events-auto grid size-9 place-content-center rounded-full border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-md transition hover:bg-surface-gray-2"
            @click="scrollTo(pastHalf ? 0 : feed?.scrollHeight)"
          >
            <span
              class="size-4"
              :class="pastHalf ? 'lucide-arrow-up' : 'lucide-arrow-down'"
              aria-hidden="true"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { Avatar, Button, Tooltip } from 'frappe-ui'

import GenericComposer from './GenericComposer.vue'
import GenericForm from './GenericForm.vue'
import { activity, formTab, tabs } from './genericMock'
import { useScrollEdges } from './useScrollEdges'

const props = defineProps<{
  compact?: boolean
  limit?: number
  withForm?: boolean
}>()

const activeTab = defineModel<string>('tab', { default: 'activity' })

const shownTabs = computed(() => (props.withForm ? [...tabs, formTab] : tabs))
const isForm = computed(() => activeTab.value === formTab.name)
const shownActivity = computed(() =>
  props.limit ? activity.slice(-props.limit) : activity,
)

const feed = useTemplateRef<HTMLElement>('feed')
const feedContent = useTemplateRef<HTMLElement>('feedContent')
const { atTop, atBottom, overflowing, pastHalf } = useScrollEdges(
  feed,
  feedContent,
)

function scrollTo(top = 0) {
  feed.value?.scrollTo({ top, behavior: 'smooth' })
}
</script>

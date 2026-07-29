<template>
  <AppShell
    class="h-full min-h-0 w-full"
    :activeDoctype="(route.params.doctype as string)"
    :activeView="(route.query.view as string)"
    appName="CRM"
  >
    <template #header>
      <div
        v-if="servingRouteDoctype"
        class="flex w-full items-center justify-between gap-3"
      >
        <PageBreadcrumbs :items="breadcrumbs" />
        <Button
          label="Save"
          variant="solid"
          :loading="saving"
          @click="saveDoc"
        />
      </div>
    </template>

    <div
      v-if="servingRouteDoctype"
      class="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
    >
      <ErrorMessage v-if="saveError" :message="saveError" />

      <FormLayout
        v-if="fieldsLayout.data?.length"
        :doc="doc"
        :layout="fieldsLayout.data || []"
      />

      <div class="mt-2 flex w-full flex-col gap-3">
        <TabButtons v-model="activeTab" :options="TABS" />

        <div v-if="activeTab === 'notes'" class="flex w-full flex-col gap-3">
          <div class="flex w-full flex-col gap-2">
            <FormControl
              v-model="noteTitle"
              class="min-w-0 flex-1"
              type="text"
              label="Title"
              placeholder="Note title"
            />
            <FormControl
              v-model="noteContent"
              class="min-w-0 flex-1"
              type="textarea"
              label="Note"
              placeholder="Write a note…"
              :rows="3"
            />
            <div class="flex w-full justify-end">
              <Button
                label="Add note"
                variant="solid"
                :loading="addingNote"
                @click="addNote"
              />
            </div>
          </div>
          <ListView
            class="min-h-[180px] w-full"
            rowKey="name"
            :columns="NOTE_COLUMNS"
            :rows="notes.data || []"
            :options="NOTE_OPTIONS"
          />
        </div>

        <div v-if="activeTab === 'tasks'" class="flex w-full flex-col gap-3">
          <div class="flex w-full items-end gap-2">
            <FormControl
              v-model="taskTitle"
              class="min-w-0 flex-1"
              type="text"
              label="Title"
              placeholder="Task title"
            />
            <FormControl
              v-model="taskDueDate"
              class="w-64 min-w-0 shrink-0 grow-0"
              type="datetime"
              label="Due date"
              placeholder="Optional"
            />
            <Button
              label="Add task"
              variant="solid"
              :loading="addingTask"
              @click="addTask"
            />
          </div>
          <ListView
            class="min-h-[180px] w-full"
            rowKey="name"
            :columns="TASK_COLUMNS"
            :rows="tasks.data || []"
            :options="TASK_OPTIONS"
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="routeDoctype.data && !routeDoctype.data.doctype"
      class="flex h-full w-full flex-1 flex-col items-center justify-center gap-2 p-6"
    >
      <p class="text-xl font-semibold text-ink-gray-8">Page not found</p>
      <p class="text-base text-ink-gray-6">
        {{ route.params.doctype }} is not a doctype you can open here.
      </p>
      <Button
        class="mt-2"
        label="Go to home"
        variant="subtle"
        @click="router.push('/')"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Button,
  ErrorMessage,
  FormControl,
  ListView,
  TabButtons,
} from 'frappe-ui'
import { FormLayout } from '@framework/ui/components/FormLayout'

import AppShell from '@/components/AppShell.vue'
import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import { detailResources } from '@/data/resources'
import { useDetailPage } from '@/composables/useDetailPage'

const TABS = [
  { label: 'Notes', value: 'notes' },
  { label: 'Tasks', value: 'tasks' },
]

const NOTE_COLUMNS = [
  { key: 'title', label: 'Title', width: '16rem' },
  { key: 'preview', label: 'Note', width: '28rem' },
  { key: 'modified', label: 'Last Modified', width: '12rem' },
]

const NOTE_OPTIONS = {
  selectable: false,
  showTooltip: true,
  emptyState: {
    title: 'No notes yet',
    description: 'Notes you add here also show up on this record in CRM.',
  },
}

const TASK_COLUMNS = [
  { key: 'title', label: 'Title', width: '20rem' },
  { key: 'status', label: 'Status', width: '10rem' },
  { key: 'priority', label: 'Priority', width: '10rem' },
  { key: 'due_date', label: 'Due Date', width: '14rem' },
]

const TASK_OPTIONS = {
  selectable: false,
  showTooltip: true,
  emptyState: {
    title: 'No tasks yet',
    description: 'Tasks you add here also show up on this record in CRM.',
  },
}

const route = useRoute()
const router = useRouter()

const resources = detailResources(
  route.params.doctype as string,
  route.params.id as string,
)
const { routeDoctype, record, notes, tasks, fieldsLayout } = resources

const {
  doc,
  activeTab,
  noteTitle,
  noteContent,
  taskTitle,
  taskDueDate,
  saving,
  saveError,
  addingNote,
  addingTask,
  breadcrumbs,
  saveDoc,
  addNote,
  addTask,
} = useDetailPage(resources)

const servingRouteDoctype = computed(
  () =>
    routeDoctype.data && routeDoctype.data.doctype === route.params.doctype,
)
</script>

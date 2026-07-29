<template>
  <PageHeaderPortal>
    <div class="flex w-full shrink-0 items-center justify-between gap-2">
      <div class="flex w-auto min-w-0 items-center gap-0.5">
        <PageBreadcrumbs :items="breadcrumbs" />
        <div v-if="viewDirty" class="ml-2 flex shrink-0 items-center gap-1.5">
          <Button label="Reset" variant="ghost" @click="resetView" />
          <Dropdown
            :button="{
              label: 'Save',
              iconRight: 'chevron-down',
              variant: 'subtle',
            }"
            :options="viewSaveOptions"
            placement="left"
          />
        </div>
      </div>
      <Button
        label="Create"
        iconLeft="plus"
        variant="solid"
        @click="openCreate"
      />
    </div>
  </PageHeaderPortal>

  <div v-if="knownDoctype" class="flex w-full min-h-0 min-w-0 flex-1 flex-col">
    <div
      :key="route.path"
      class="flex w-full shrink-0 items-start justify-between gap-2 px-5 pt-3.5"
    >
      <div class="flex min-w-0 flex-1 flex-col">
        <QuickFilter
          v-model:filters="filters"
          v-model:customizing="customizing"
          :doctype="route.params.doctype as string"
        />
      </div>
      <div v-if="!customizing" class="flex shrink-0 items-center gap-2">
        <Filter v-model="filters" :doctype="route.params.doctype as string" />
        <SortBy v-model="sort" :doctype="route.params.doctype as string" />
        <ColumnSettings
          v-model="columns"
          :doctype="route.params.doctype as string"
        />
        <Dropdown
          :button="{ icon: 'more-horizontal', variant: 'subtle' }"
          :options="controlOptions"
          placement="right"
        />
      </div>
    </div>

    <div class="flex w-full min-h-0 min-w-0 flex-1 flex-col pt-2">
      <ListSurface
        v-model:selection="selection"
        v-model:pageSize="pageSize"
        class="w-full flex-1"
        :columns="listColumns"
        :rows="listRows"
        :loading="listLoading"
        :hasLiveCounts="hasLiveCounts"
        :bulkActions="bulkActions"
        :rowCount="listData.data?.row_count ?? 0"
        :totalCount="listData.data?.total_count ?? 0"
        :options="surfaceOptions"
        rowKey="name"
        gutter="12px"
        :rowHeight="40"
        :pageLengthOptions="[20, 100, 500, 2500]"
        @column-resize="resizeColumn($event.key, $event.width)"
        @column-reset="resetColumnWidth($event.key)"
        @load-more="loadMore"
        @page-size="setPageSize"
      />
    </div>

    <Dialog
      v-model="saveAsDialog"
      title="Save as new view"
      size="sm"
      :actions="saveAsActions"
    >
      <template #body-content>
        <TextInput
          v-model="saveAsLabel"
          class="w-full"
          size="md"
          placeholder="e.g. My open deals"
        />
      </template>
    </Dialog>

    <Dialog
      v-model="createDialog"
      :title="createTitle"
      size="xl"
      :actions="createActions"
    >
      <template #body-content>
        <FormLayout
          v-if="createLayout.data?.length"
          class="w-full"
          :doc="newDoc"
          :layout="createLayout.data || []"
        />
        <ErrorMessage v-if="createError" :message="createError" />
      </template>
    </Dialog>

    <Dialog
      v-model="deleteDialog"
      :title="deleteTitle"
      :actions="deleteActions"
    >
      <template #body-content>
        <p class="text-base text-ink-gray-6">This cannot be undone.</p>
        <ErrorMessage v-if="deleteError" :message="deleteError" />
      </template>
    </Dialog>
  </div>

  <NotFoundPage v-else :doctype="route.params.doctype as string" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, ErrorMessage, TextInput } from 'frappe-ui'
import { Filter } from '@framework/ui/components/Filter'
import { SortBy } from '@framework/ui/components/SortBy'
import { ColumnSettings } from '@framework/ui/components/ColumnSettings'
import { QuickFilter } from '@framework/ui/components/QuickFilter'
import { FormLayout } from '@framework/ui/components/FormLayout'

import ListSurface from '@/components/ListSurface.vue'
import NotFoundPage from '@/components/NotFoundPage.vue'
import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import { routeDoctype } from '@/data/doctypes'
import { listResources } from '@/data/resources'
import { useListPage } from '@/composables/useListPage'

const route = useRoute()
const router = useRouter()

const knownDoctype = computed(
  () => routeDoctype(route.params.doctype as string) !== null,
)

const resources = listResources(route.params.doctype as string)
const { listData, createLayout } = resources

const {
  filters,
  sort,
  columns,
  customizing,
  pageSize,
  selection,
  listColumns,
  listLoading,
  listRows,
  hasLiveCounts,
  breadcrumbs,
  controlOptions,
  resizeColumn,
  resetColumnWidth,
  loadMore,
  setPageSize,
  viewDirty,
  resetView,
  viewSaveOptions,
  saveAsDialog,
  saveAsLabel,
  saveAsActions,
  createDialog,
  newDoc,
  createError,
  createTitle,
  createActions,
  openCreate,
  deleteDialog,
  deleteError,
  deleteTitle,
  bulkActions,
  deleteActions,
} = useListPage(resources)

const surfaceOptions = computed(() => ({
  showTooltip: true,
  emptyState: {
    title: 'No records',
    description: 'Nothing to show here yet.',
  },
  onRowClick: (row: any) =>
    router.push({
      path: `/${encodeURIComponent(route.params.doctype as string)}/${encodeURIComponent(row.name)}`,
      query: route.params.viewName ? { view: route.params.viewName } : {},
    }),
}))
</script>

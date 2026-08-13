<template>
  <!-- isolate: the page's z-10/z-20 layers beat a dialog overlay's z-index:auto
       otherwise, and stay lit while the rest of the page dims. -->
  <div v-if="knownDoctype" class="isolate flex w-full min-h-0 min-w-0 flex-1">
    <RecordHeader
      :breadcrumbs="breadcrumbs"
      :doctype="doctype"
      :docname="docname"
      :doc="doc"
      :chrome="chrome"
      :isDirty="isDirty"
      :saving="saving"
      @save="save"
    />

    <RecordTabs
      v-model:doc="doc"
      class="min-w-0"
      :doctype="doctype"
      :docname="docname"
      :docinfo="docinfo"
      :feeds="feeds"
      :layout="layout"
    />

    <RecordPanel
      v-model:doc="doc"
      :doctype="doctype"
      :docname="docname"
      :chrome="chrome"
      :layout="panelLayout"
    />

    <SaveConflictDialog
      v-if="conflict"
      v-model="conflictVisible"
      :conflict="conflict"
      @resolve="resolveConflict"
      @discard="discardConflict"
    />

    <!-- Scripts' `page.dialog.open`/`form` stack. Inside the record page on
         purpose: leaving the record unmounts it, which closes what a script
         left open. -->
    <PageDialogs :controller="pageController" />
  </div>

  <NotFoundPage v-else :doctype="doctype" />
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'

import { PageDialogs } from '@framework/ui/experimental'
import NotFoundPage from '@/components/NotFoundPage.vue'
import RecordHeader from '@/components/record/RecordHeader.vue'
import RecordPanel from '@/components/record/RecordPanel.vue'
import RecordTabs from '@/components/record/RecordTabs.vue'
import SaveConflictDialog from '@/components/record/SaveConflictDialog.vue'
import { routeDoctype } from '@/data/doctypes'
import { RecordPageKey } from '@/data/pageContext'
import { recordResources } from '@/data/resources'
import { useRecordPage } from '@/composables/useRecordPage'

const route = useRoute()

const doctype = route.params.doctype as string
const docname = route.params.id as string

const resources = recordResources(doctype, docname)

const {
  doc,
  layout,
  panelLayout,
  pageController,
  isDirty,
  saving,
  breadcrumbs,
  feeds,
  save,
  conflict,
  conflictVisible,
  resolveConflict,
  discardConflict,
  docinfo,
  chrome,
} = useRecordPage(resources)

provide(RecordPageKey, pageController)

const knownDoctype = computed(() => routeDoctype(doctype) !== null)
</script>

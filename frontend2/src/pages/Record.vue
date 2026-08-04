<template>
  <!-- isolate: the page's z-10/z-20 layers beat a dialog overlay's z-index:auto
       otherwise, and stay lit while the rest of the page dims. -->
  <div v-if="knownDoctype" class="isolate flex w-full min-h-0 min-w-0 flex-1">
    <RecordHeader
      :breadcrumbs="breadcrumbs"
      :assignees="assignees"
      :isDirty="isDirty"
      :saving="saving"
      @save="save"
      @assign="assign"
      @unassign="unassign"
    />

    <RecordTabs
      v-model:doc="doc"
      :doctype="doctype"
      :docname="docname"
      :docinfo="docinfo"
      :feeds="feeds"
      :layout="fieldsLayout.data || []"
    />
  </div>

  <NotFoundPage v-else :doctype="doctype" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import NotFoundPage from '@/components/NotFoundPage.vue'
import RecordHeader from '@/components/record/RecordHeader.vue'
import RecordTabs from '@/components/record/RecordTabs.vue'
import { routeDoctype } from '@/data/doctypes'
import { recordResources } from '@/data/resources'
import { useRecordPage } from '@/composables/useRecordPage'

const route = useRoute()

const doctype = route.params.doctype as string
const docname = route.params.id as string

const resources = recordResources(doctype, docname)
const { fieldsLayout } = resources

const {
  doc,
  isDirty,
  saving,
  breadcrumbs,
  feeds,
  save,
  docinfo,
  assignees,
  assign,
  unassign,
} = useRecordPage(resources)

const knownDoctype = computed(() => routeDoctype(doctype) !== null)
</script>

<template>
  <PageHeaderPortal>
    <div
      v-if="knownDoctype"
      class="flex w-full items-center justify-between gap-3"
    >
      <PageBreadcrumbs :items="breadcrumbs" />
      <Button label="Save" variant="solid" :loading="saving" @click="saveDoc" />
    </div>
  </PageHeaderPortal>

  <div
    v-if="knownDoctype"
    ref="scroller"
    class="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
  >
    <ErrorMessage v-if="saveError" :message="saveError" />

    <FormLayout
      v-if="fieldsLayout.data?.length"
      :doc="doc"
      :layout="fieldsLayout.data || []"
    />
  </div>

  <NotFoundPage v-else :doctype="route.params.doctype as string" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button, ErrorMessage } from 'frappe-ui'
import { FormLayout } from '@framework/ui/components/FormLayout'

import NotFoundPage from '@/components/NotFoundPage.vue'
import PageBreadcrumbs from '@/components/PageBreadcrumbs.vue'
import PageHeaderPortal from '@/components/PageHeaderPortal.vue'
import { routeDoctype } from '@/data/doctypes'
import { detailResources } from '@/data/resources'
import { useDetailPage } from '@/composables/useDetailPage'
import { useScrollRestore } from '@/composables/usePageState'

const route = useRoute()

const resources = detailResources(
  route.params.doctype as string,
  route.params.id as string,
)
const { record, fieldsLayout } = resources

const { doc, saving, saveError, breadcrumbs, saveDoc } =
  useDetailPage(resources)

const scroller = ref<HTMLElement | null>(null)

useScrollRestore(scroller, () =>
  Boolean(record.data && fieldsLayout.data?.length),
)

const knownDoctype = computed(
  () => routeDoctype(route.params.doctype as string) !== null,
)
</script>

<template>
  <div class="flex h-full flex-col pb-0 p-8 gap-8 overflow-hidden">
    <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
      {{ __('Billing') }}
    </h2>
    <div
      v-if="!data.get.loading"
      class="flex flex-col gap-8 flex-1 overflow-y-auto"
    >
      <div class="flex flex-col gap-2 border text-base rounded p-3">
        <div class="flex justify-between">
          <div class="flex flex-col gap-1">
            <div class="font-medium text-lg">{{ __('Current Plan') }}</div>
            <div class="text-gray-600 text-sm">
              {{ __('Support included') }}
            </div>
          </div>
          <div class="text-lg">
            <span class="font-bold">₹410</span>
            <span class="text-gray-600">{{ __(' / month') }}</span>
          </div>
        </div>
        <div class="flex flex-row-reverse">
          <Button variant="solid" :label="__('Upgrade Plan')" />
        </div>
      </div>
      <div class="flex flex-col gap-3 text-base">
        <div class="font-medium text-lg">{{ __('Details') }}</div>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Current billing amount') }}
              </div>
              <Button :label="__('Details')" />
            </div>
            <div>₹ 9,625.33</div>
          </div>
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Unpaid amount') }}
              </div>
              <Button :label="__('Pay')">
                <template #prefix>
                  <FeatherIcon class="h-4" name="credit-card" />
                </template>
              </Button>
            </div>
            <div>₹ 0</div>
          </div>
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Amount balance') }}
              </div>
              <Button :label="__('Add')">
                <template #prefix>
                  <FeatherIcon class="h-4" name="plus" /> </template
              ></Button>
            </div>
            <div>₹ 17,197.90</div>
          </div>
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Payment mode') }}
              </div>
              <Button :label="__('Change')" />
            </div>
            <div>Prepaid Credits</div>
          </div>
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Billing details') }}
              </div>
              <Button :label="__('Update')" />
            </div>
            <div>
              Software At Work (I) Pvt. Ltd., #3 , Magnum Opus, Shantinagar,
              Vakola, Santacruz (E)
            </div>
          </div>
          <div class="flex flex-col gap-1 border rounded p-3">
            <div class="flex items-center justify-between">
              <div class="text-gray-600 mb-1">
                {{ __('Payment method') }}
              </div>
              <Button :label="__('Change')" />
            </div>
            <div>Vikram Seth •••• 1004 · Expiry 8/2025</div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 text-base">
        <div class="font-medium text-lg">{{ __('Invoices') }}</div>
        <div>
          <ListView
            :columns="columns"
            :rows="rows"
            row-key="name"
            :options="{
              selectable: false,
            }"
          >
            <ListHeader />
            <ListRows>
              <ListRow
                v-for="row in rows"
                :key="row.name"
                v-slot="{ column, item }"
                :row="row"
              >
                <ListRowItem :item="item" :align="column.align">
                  <Badge
                    v-if="column.key == 'status'"
                    variant="subtle"
                    :theme="item.color"
                    size="md"
                    :label="item.label"
                  />
                  <Button
                    v-if="column.key == 'download'"
                    variant="ghost"
                    icon="download"
                  />
                </ListRowItem>
              </ListRow>
            </ListRows>
          </ListView>
        </div>
      </div>
    </div>
    <div v-else class="flex flex-1 items-center justify-center">
      <Spinner class="size-8" />
    </div>
  </div>
  <div class="flex flex-row-reverse text-sm px-6 py-4 text-gray-600">
    {{ __('Powered by Frappe Cloud') }}
  </div>
</template>
<script setup>
import {
  FeatherIcon,
  Spinner,
  ListView,
  ListHeader,
  ListRows,
  ListRow,
  ListRowItem,
  Badge,
} from 'frappe-ui'
import { ref } from 'vue'

const data = ref({
  get: {
    loading: false,
  },
})

const columns = [
  {
    label: 'Invoice',
    key: 'name',
  },
  {
    label: 'Status',
    key: 'status',
    width: 0.8,
  },
  {
    label: 'Period',
    key: 'due_date',
    width: 1.5,
  },
  {
    label: 'Total',
    key: 'total',
    width: 1.2,
  },
  {
    label: '',
    key: 'download',
    width: 0.5,
  },
]

const rows = [
  {
    name: 'August 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Aug 1 - Aug 31, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'July 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Jul 1 - Jul 31, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'June 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Jun 1 - Jun 30, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'May 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'May 1 - May 31, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'April 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Apr 1 - Apr 30, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'March 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Mar 1 - Mar 31, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'February 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Feb 1 - Feb 29, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
  {
    name: 'January 2024',
    status: {
      label: 'Paid',
      color: 'green',
    },
    due_date: 'Jan 1 - Jan 31, 2024',
    total: '₹ 9,625.33',
    download: '#',
  },
]
</script>

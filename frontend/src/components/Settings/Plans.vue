<template>
  <div class="flex h-full flex-col pb-0 p-8 gap-8 overflow-hidden">
    <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
      {{ __('Plans') }}
    </h2>
    <div
      v-if="!data.get.loading"
      class="grid grid-cols-3 gap-2 flex-1 overflow-y-auto"
    >
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 2,050.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 68.33 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>2</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>1 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>25 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 4,100.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 136.67 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>4</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>2 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>25 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 8,200.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 273.33 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>8</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>4 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>25 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 16,400.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 546.67 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>16</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>8 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>50 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 24,600.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 820.00 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>24</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>12 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>50 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 32,800.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 1093.33 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>32</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>16 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>50 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 41,000.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 1366.67 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>40</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>20 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>50 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
      <div class="border rounded p-3">
        <div>
          <span class="font-medium text-gray-900">₹ 82,000.00</span>
          <span class="text-gray-700"> / mo</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">₹ 2733.33 / day</div>
        <div class="border-b my-2"></div>
        <div class="text-p-sm text-gray-800">
          <div>
            <span>80</span>
            <span class="text-gray-600"> compute hours / day</span>
          </div>
          <div>
            <span>40 GB</span><span class="ml-1 text-gray-600"> Database</span>
          </div>
          <div>
            <span>100 GB</span><span class="ml-1 text-gray-600"> Disk</span>
          </div>
          <div>Product Warranty</div>
          <div>Support Included</div>
          <div>Database Access</div>
          <div>Offsite Backups</div>
        </div>
      </div>
    </div>
    <div v-else class="flex flex-1 items-center justify-center">
      <Spinner class="size-8" />
    </div>
  </div>
  <div
    class="flex flex-row-reverse items-center justify-between text-sm px-6 py-4 text-gray-600"
  >
    <Button variant="solid" :label="__('Upgrade Plan')" />
    <div>{{ __('Powered by Frappe Cloud') }}</div>
  </div>
</template>
<script setup>
import { Spinner } from 'frappe-ui'
import { ref } from 'vue'

const data = ref({
  get: {
    loading: false,
  },
})
</script>

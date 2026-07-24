<template>
  <Dialog v-model="open" size="sm">
    <template #body>
      <div class="p-4 pt-5">
        <div class="flex flex-col items-center">
          <img :src="logoUrl" alt="" class="mb-3 size-12 rounded-xl" />
          <h3 class="text-2xl-semibold text-ink-gray-9">Frappe CRM</h3>
        </div>
        <hr class="mx-2 my-3 border-t" />
        <a
          v-for="link in links"
          :key="link.label"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="flex items-center rounded px-2 py-2 hover:bg-surface-gray-1"
        >
          <Icon :name="link.icon" class="mr-2 size-4 text-ink-gray-7" />
          <span class="text-base text-ink-gray-8">{{ link.label }}</span>
        </a>
        <hr class="mx-2 my-3 border-t" />
        <p class="px-2 text-sm text-ink-gray-6">
          © Frappe Technologies Pvt. Ltd. and contributors
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { Icon } from 'frappe-ui/icons'

const open = defineModel<boolean>()

const logoUrl = '/assets/crm/images/logo.svg'

const links = [
  { label: 'Website', url: 'https://frappe.io/crm', icon: 'globe' },
  {
    label: 'GitHub Repository',
    url: 'https://github.com/frappe/crm',
    icon: 'git-fork',
  },
  {
    label: 'Documentation',
    url: 'https://docs.frappe.io/crm',
    icon: 'book-open',
  },
  {
    label: 'Report an Issue',
    url: 'https://github.com/frappe/crm/issues',
    icon: 'bug',
  },
  {
    label: 'Contact Support',
    url: 'https://support.frappe.io',
    icon: 'headset',
  },
]
</script>

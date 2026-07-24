<template>
  <SettingsHeader
    title="Users"
    description="People with access to this workspace."
  />
  <SettingsBody>
    <div v-if="users.list.loading" class="flex flex-col gap-4">
      <div v-for="row in 4" :key="row" class="flex items-center gap-3">
        <Skeleton class="size-8 rounded-full" />
        <Skeleton class="h-4 w-48" />
      </div>
    </div>
    <ErrorMessage
      v-else-if="users.list.error"
      :message="users.list.error.messages?.[0] || 'Could not load users.'"
    />
    <ul v-else class="divide-y divide-outline-gray-1">
      <li
        v-for="user in users.data || []"
        :key="user.name"
        class="flex items-center gap-3 py-2.5"
      >
        <Avatar
          :image="user.user_image"
          :label="user.full_name || user.name"
          size="lg"
        />
        <div class="min-w-0">
          <div class="truncate text-base text-ink-gray-8">
            {{ user.full_name || user.name }}
          </div>
          <div class="truncate text-sm text-ink-gray-5">{{ user.name }}</div>
        </div>
      </li>
    </ul>
  </SettingsBody>
</template>

<script setup lang="ts">
import {
  Avatar,
  ErrorMessage,
  SettingsBody,
  SettingsHeader,
  Skeleton,
  createListResource,
} from 'frappe-ui'

const users = createListResource({
  doctype: 'User',
  fields: ['name', 'full_name', 'user_image'],
  filters: {
    enabled: 1,
    user_type: 'System User',
    name: ['not in', ['Administrator', 'Guest']],
  },
  orderBy: 'full_name asc',
  pageLength: 99,
  auto: true,
})
</script>

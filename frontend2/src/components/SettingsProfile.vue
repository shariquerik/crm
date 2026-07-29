<template>
  <SettingsHeader
    title="Profile"
    description="How you appear to others in this workspace."
  />
  <SettingsBody>
    <div class="flex max-w-md flex-col gap-6">
      <div class="flex items-center gap-4">
        <Avatar :image="currentUser.user_image" :label="userLabel" size="3xl" />
        <div class="min-w-0">
          <div class="truncate text-base font-medium text-ink-gray-8">
            {{ userLabel }}
          </div>
          <div class="truncate text-sm text-ink-gray-5">
            {{ currentUser.email }}
          </div>
        </div>
      </div>
      <FormControl v-model="fullName" label="Full name" />
      <FormControl
        label="Email"
        type="email"
        :modelValue="currentUser.email"
        disabled
      />
      <ErrorMessage :message="error" />
      <div>
        <Button
          variant="solid"
          :loading="saving"
          :disabled="!dirty"
          @click="save"
        >
          Save changes
        </Button>
      </div>
    </div>
  </SettingsBody>
</template>

<script setup lang="ts">
import {
  Avatar,
  Button,
  ErrorMessage,
  FormControl,
  SettingsBody,
  SettingsHeader,
} from 'frappe-ui'
import { computed, ref } from 'vue'

import { currentUser, saveFullName, userLabel } from '@/data/session'

const fullName = ref(currentUser.value.full_name || '')

const dirty = computed(
  () =>
    fullName.value.trim() !== (currentUser.value.full_name || '') &&
    Boolean(fullName.value.trim()),
)

const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  error.value = ''
  try {
    await saveFullName(fullName.value.trim())
  } catch (exception: any) {
    error.value = exception?.messages?.[0] || 'Could not save your profile.'
  } finally {
    saving.value = false
  }
}
</script>

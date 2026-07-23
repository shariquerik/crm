<template>
  <SettingsDialog v-model="open" v-model:tab="tab">
    <template #title>CRM settings</template>
    <SettingsSidebar>
      <SettingsNavGroup label="Personal">
        <SettingsNavItem value="profile">
          <template #prefix>
            <Avatar
              :image="currentUser.user_image"
              :label="userLabel"
              size="xs"
            />
          </template>
          Profile
        </SettingsNavItem>
      </SettingsNavGroup>
      <SettingsNavGroup label="Workspace">
        <SettingsNavItem value="users">
          <template #prefix>
            <Icon name="users" class="size-4" />
          </template>
          Users
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsSidebar>
    <SettingsContent>
      <SettingsPanel value="profile">
        <CrmSettingsProfile />
      </SettingsPanel>
      <SettingsPanel value="users">
        <CrmSettingsUsers />
      </SettingsPanel>
    </SettingsContent>
  </SettingsDialog>
</template>

<script setup lang="ts">
import {
  Avatar,
  SettingsContent,
  SettingsDialog,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsPanel,
  SettingsSidebar,
} from 'frappe-ui'
import { Icon } from 'frappe-ui/icons'

import CrmSettingsProfile from '@app/components/CrmSettingsProfile.vue'
import CrmSettingsUsers from '@app/components/CrmSettingsUsers.vue'
import { useSettingsDialog } from '@app/composables/useSettingsDialog'
import { currentUser, userLabel } from '@app/data/session'

const { open, tab } = useSettingsDialog()
</script>

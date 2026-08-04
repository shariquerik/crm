<!-- PROTOTYPE — throwaway. The share dialog is the "shared with" display; there is no
     separate surface for it. -->
<template>
  <Dialog v-model="open" :options="{ title: 'Share this record' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <!-- Without this the dialog focuses its close button, which then wears a focus
             ring over the thing you came here to type into. -->
        <FormControl autofocus placeholder="Add people by name or email" />

        <div class="flex flex-col">
          <div
            v-for="person in sharedWith"
            :key="person.fullName"
            class="flex items-center gap-2 py-1.5"
          >
            <Avatar :label="person.fullName" size="md" />
            <span class="truncate text-base text-ink-gray-8">
              {{ person.fullName }}
            </span>
            <span class="ml-auto text-base text-ink-gray-5">Can edit</span>
          </div>
        </div>

        <div
          class="flex items-center gap-2 border-t border-outline-gray-1 pt-3"
        >
          <span class="lucide-bell size-4 text-ink-gray-5" aria-hidden="true" />
          <span class="text-base text-ink-gray-6">
            {{ followers.length }} people follow this record
          </span>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Avatar, Dialog, FormControl } from 'frappe-ui'

const open = defineModel<boolean>({ default: false })

const sharedWith = [{ fullName: 'Priya Nair' }]
const followers = [{ fullName: 'Sarah Connor' }, { fullName: 'Lars Vogt' }]
</script>

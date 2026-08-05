<!-- The share dialog is the "shared with" display; there is no separate surface for it. -->
<template>
  <Dialog v-model="open" :options="{ title: 'Share this record' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <!-- autofocus, or the dialog focuses its close button and opens wearing a
             focus ring. -->
        <Combobox
          autofocus
          :modelValue="''"
          :options="options"
          :loading="loading"
          :empty-text="error || 'No users found'"
          placeholder="Add people by name or email"
          @update:modelValue="shareWith"
          @update:query="searchSoon"
          @update:open="(shown: boolean) => shown && !searched && search()"
        >
          <template #item-prefix="{ item }">
            <Avatar
              :label="item.label"
              :image="(item as UserOption).image"
              size="sm"
            />
          </template>
        </Combobox>

        <div class="flex flex-col">
          <div
            v-for="person in shared"
            :key="person.user"
            class="group/share flex items-center gap-2 py-1.5"
          >
            <Avatar :label="person.fullName" :image="person.image" size="md" />
            <span class="truncate text-base text-ink-gray-8">
              {{ person.fullName }}
            </span>
            <span class="ml-auto text-base text-ink-gray-5">
              {{ person.canWrite ? 'Can edit' : 'Can view' }}
            </span>
            <Button
              class="opacity-0 transition group-hover/share:opacity-100 focus-visible:opacity-100"
              icon="lucide-x"
              variant="ghost"
              :aria-label="`Stop sharing with ${person.fullName}`"
              @click="emit('unshare', person.user)"
            />
          </div>

          <p v-if="!shared.length" class="py-1.5 text-base text-ink-gray-5">
            This record is not shared with anyone.
          </p>
        </div>

        <div
          class="flex items-center gap-2 border-t border-outline-gray-1 pt-3"
        >
          <span class="lucide-bell size-4 text-ink-gray-5" aria-hidden="true" />
          <span class="text-base text-ink-gray-6">{{ followerLine }}</span>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Avatar, Button, Combobox, Dialog, call } from 'frappe-ui'

import { useUserSearch, type UserOption } from '@/composables/useUserSearch'
import type { SharedUser } from '@/data/docinfo'
import { errorMessage } from '@/data/errors'

const props = defineProps<{
  doctype: string
  docname: string
  shared: SharedUser[]
}>()

const emit = defineEmits<{ share: [string]; unshare: [string] }>()

const open = defineModel<boolean>({ default: false })

const sharedOptions = computed<UserOption[]>(() =>
  props.shared.map(({ user, fullName, image }) => ({
    label: fullName,
    value: user,
    image,
  })),
)

const { options, loading, error, searched, search, searchSoon } =
  useUserSearch(sharedOptions)

function shareWith(user: string | null) {
  if (user) emit('share', user)
}

const followerLine = ref('')

// No bucket carries the followers, and only this line shows them.
watch(open, async (shown) => {
  if (!shown) return
  followerLine.value = 'Counting followers…'
  try {
    const users = await call(
      'frappe.desk.form.document_follow.get_follow_users',
      { doctype: props.doctype, doc_name: props.docname },
    )
    followerLine.value = followersFound(users?.length ?? 0)
  } catch (error: any) {
    followerLine.value = errorMessage(error)
  }
})

function followersFound(count: number) {
  if (count === 1) return '1 person follows this record'
  return `${count} people follow this record`
}
</script>

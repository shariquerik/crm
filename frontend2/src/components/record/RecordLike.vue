<!-- The like button, over the card naming everyone who has liked the record. -->
<template>
  <DefineButton>
    <Button
      variant="subtle"
      :aria-label="liked ? 'Unlike' : 'Like'"
      :aria-pressed="liked"
      @click="emit('toggle')"
    >
      <template #icon>
        <!-- Drawn here, not off a lucide mask, so the liked stroke can thicken. -->
        <svg
          class="size-4"
          :class="liked ? 'fill-ink-red-5 stroke-ink-red-5' : 'text-ink-gray-7'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          :stroke-width="liked ? 2.5 : 1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          />
        </svg>
      </template>
    </Button>
  </DefineButton>

  <!-- No likers, no card: an empty one would still open as a blank panel. -->
  <LikeButton v-if="!likers.length" />
  <HoverCard
    v-else
    :hover-delay="0.2"
    :leave-delay="0.2"
    side="bottom"
    align="end"
  >
    <template #trigger>
      <LikeButton />
    </template>

    <template #default>
      <div class="flex min-w-44 max-w-64 flex-col gap-2 p-3">
        <div
          v-for="liker in likers"
          :key="liker.email"
          class="flex items-center gap-2"
        >
          <Avatar :label="liker.fullName" :image="liker.image" size="md" />
          <span class="truncate text-p-base text-ink-gray-8">
            {{ liker.fullName }}
          </span>
        </div>
      </div>
    </template>
  </HoverCard>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { Avatar, Button, HoverCard } from 'frappe-ui'

import type { Liker } from '@/data/docinfo'

defineProps<{ likers: Liker[]; liked: boolean }>()

const [DefineButton, LikeButton] = createReusableTemplate()

const emit = defineEmits<{ toggle: [] }>()
</script>

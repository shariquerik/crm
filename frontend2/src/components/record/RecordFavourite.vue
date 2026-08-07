<!-- The favourite button, over the card naming everyone who has favourited the record. -->
<template>
  <DefineButton>
    <Button
      variant="ghost"
      :aria-label="favourited ? 'Remove from favourites' : 'Add to favourites'"
      :aria-pressed="favourited"
      @click="emit('toggle')"
    >
      <template #icon>
        <!-- Drawn here, not off a lucide mask, so the favourited stroke can thicken. -->
        <svg
          class="size-4"
          :class="
            favourited
              ? 'fill-ink-amber-5 stroke-ink-amber-5'
              : 'text-ink-gray-7'
          "
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          :stroke-width="favourited ? 2.5 : 1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M12 2.5l2.9 5.88 6.6.96-4.75 4.63 1.12 6.53L12 17.4l-5.87 3.1 1.12-6.53L2.5 9.34l6.6-.96z"
          />
        </svg>
      </template>
    </Button>
  </DefineButton>

  <!-- No favourites, no card: an empty one would still open as a blank panel. The
       tooltip stands in for it, so the star is never bare on hover. -->
  <Tooltip v-if="!favourites.length" text="Add to favourites">
    <FavouriteButton />
  </Tooltip>
  <HoverCard
    v-else
    :hover-delay="0.2"
    :leave-delay="0.2"
    side="bottom"
    align="end"
  >
    <template #trigger>
      <FavouriteButton />
    </template>

    <template #default>
      <div class="flex min-w-44 max-w-64 flex-col gap-2 p-3">
        <div
          v-for="favourite in favourites"
          :key="favourite.email"
          class="flex items-center gap-2"
        >
          <Avatar
            :label="favourite.fullName"
            :image="favourite.image"
            size="md"
          />
          <span class="truncate text-p-base text-ink-gray-8">
            {{ favourite.fullName }}
          </span>
        </div>
      </div>
    </template>
  </HoverCard>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { Avatar, Button, HoverCard, Tooltip } from 'frappe-ui'

import type { Liker } from '@/data/docinfo'

defineProps<{ favourites: Liker[]; favourited: boolean }>()

const [DefineButton, FavouriteButton] = createReusableTemplate()

const emit = defineEmits<{ toggle: [] }>()
</script>

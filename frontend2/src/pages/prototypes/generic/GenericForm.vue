<!-- PROTOTYPE — throwaway. The doctype's own fields, rendered from meta sections. -->
<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-7 py-6">
    <section v-for="section in formSections" :key="section.label">
      <h3 class="mb-3 text-base font-semibold text-ink-gray-8">
        {{ section.label }}
      </h3>
      <div class="grid grid-cols-2 gap-x-6 gap-y-2">
        <div
          v-for="field in section.fields"
          :key="field.label"
          class="grid grid-cols-[130px_1fr] items-center gap-2"
        >
          <span class="truncate text-base text-ink-gray-5">{{
            field.label
          }}</span>
          <div
            class="flex min-w-0 items-center gap-1.5 rounded px-2 py-1.5"
            :class="
              field.readOnly ? 'text-ink-gray-6' : 'hover:bg-surface-gray-2'
            "
            @click="editField(field)"
          >
            <span
              class="truncate text-base"
              :class="field.value ? 'text-ink-gray-8' : 'text-ink-gray-4'"
            >
              {{ field.value || `Add ${field.label}...` }}
            </span>
            <span
              v-if="field.link"
              class="lucide-arrow-up-right ml-auto size-3.5 shrink-0 text-ink-gray-5"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { editField } from './dirtyState'
import { formSections } from './genericMock'
</script>

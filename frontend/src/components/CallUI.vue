<template>
  <div
    v-show="showCallPopup"
    ref="callPopup"
    class="fixed select-none z-10 bg-gray-900 text-gray-300 rounded-lg shadow-2xl p-4 flex flex-col w-60 cursor-move"
    :style="style"
  >
    <div class="flex items-center flex-row-reverse gap-1">
      <MinimizeIcon class="w-4 h-4 cursor-pointer" @click="toggleCallWindow" />
    </div>
    <div class="flex flex-col justify-center items-center gap-3">
      <Avatar
        :image="contact.image"
        :label="contact.full_name"
        class="flex items-center justify-center [&>div]:text-[30px] !h-24 !w-24 relative"
        :class="onCall || calling ? '' : 'pulse'"
      />
      <div class="flex flex-col items-center justify-center gap-1">
        <div class="text-xl font-medium">
          {{ contact.full_name }}
        </div>
        <div class="text-sm text-gray-600">{{ contact.mobile_no }}</div>
      </div>
      <CountUpTimer ref="counterUp">
        <div v-if="onCall" class="text-base my-1">
          {{ counterUp?.updatedTime }}
        </div>
      </CountUpTimer>
      <div v-if="!onCall" class="text-base my-1">
        {{
          callStatus == 'ringing'
            ? 'Ringing...'
            : calling
            ? 'Calling...'
            : 'Incoming call...'
        }}
      </div>
      <div v-if="onCall" class="flex gap-2">
        <Button
          :icon="muted ? 'mic-off' : 'mic'"
          class="rounded-full"
          @click="toggleMute"
        />
        <Button class="rounded-full">
          <template #icon>
            <DialpadIcon class="rounded-full cursor-pointer" />
          </template>
        </Button>
        <Button class="rounded-full">
          <template #icon>
            <NoteIcon
              class="text-gray-900 rounded-full cursor-pointer h-4 w-4"
              @click="showNoteModal = true"
            />
          </template>
        </Button>
        <Button class="rounded-full bg-red-600 hover:bg-red-700">
          <template #icon>
            <PhoneIcon
              class="text-white fill-white h-4 w-4 rotate-[135deg]"
              @click="hangUpCall"
            />
          </template>
        </Button>
      </div>
      <div v-else-if="calling">
        <Button
          size="md"
          variant="solid"
          theme="red"
          label="Cancel"
          @click="cancelCall"
          class="rounded-lg"
        >
          <template #prefix>
            <PhoneIcon class="fill-white h-4 w-4 rotate-[135deg]" />
          </template>
        </Button>
      </div>
      <div v-else class="flex gap-2">
        <Button
          size="md"
          variant="solid"
          theme="green"
          label="Accept"
          class="rounded-lg"
          @click="acceptIncomingCall"
        >
          <template #prefix>
            <PhoneIcon class="fill-white h-4 w-4" />
          </template>
        </Button>
        <Button
          size="md"
          variant="solid"
          theme="red"
          label="Reject"
          class="rounded-lg"
          @click="rejectIncomingCall"
        >
          <template #prefix>
            <PhoneIcon class="fill-white h-4 w-4 rotate-[135deg]" />
          </template>
        </Button>
      </div>
    </div>
  </div>
  <div
    v-show="showSmallCallWindow"
    class="flex items-center justify-between gap-3 bg-gray-900 text-base text-gray-300 -ml-3 mr-2 px-2 py-[7px] rounded-lg cursor-pointer select-none"
    @click="toggleCallWindow"
  >
    <div class="flex items-center gap-2">
      <Avatar
        :image="contact.image"
        :label="contact.full_name"
        class="flex items-center justify-center !h-5 !w-5 relative"
      />
      <div class="truncate max-w-[120px]">
        {{ contact.full_name }}
      </div>
    </div>
    <div v-if="onCall" class="flex items-center gap-2">
      <div class="my-1 min-w-[40px] text-center">
        {{ counterUp?.updatedTime }}
      </div>
      <Button variant="solid" theme="red" class="rounded-full !h-6 !w-6">
        <template #icon>
          <PhoneIcon
            class="fill-white h-4 w-4 rotate-[135deg]"
            @click.stop="hangUpCall"
          />
        </template>
      </Button>
    </div>
    <div v-else-if="calling" class="flex items-center gap-3">
      <div class="my-1">
        {{ callStatus == 'ringing' ? 'Ringing...' : 'Calling...' }}
      </div>
      <Button
        variant="solid"
        theme="red"
        class="rounded-full !h-6 !w-6"
        @click.stop="cancelCall"
      >
        <template #icon>
          <PhoneIcon class="fill-white h-4 w-4 rotate-[135deg]" />
        </template>
      </Button>
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        variant="solid"
        theme="green"
        class="rounded-full !h-6 !w-6 pulse relative"
        @click.stop="acceptIncomingCall"
      >
        <template #icon>
          <PhoneIcon class="fill-white h-4 w-4 animate-pulse" />
        </template>
      </Button>
      <Button
        variant="solid"
        theme="red"
        class="rounded-full !h-6 !w-6"
        @click.stop="rejectIncomingCall"
      >
        <template #icon>
          <PhoneIcon class="fill-white h-4 w-4 rotate-[135deg]" />
        </template>
      </Button>
    </div>
  </div>
  <NoteModal v-model="showNoteModal" :note="note" @updateNote="updateNote" />
</template>

<script setup>
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import MinimizeIcon from '@/components/Icons/MinimizeIcon.vue'
import DialpadIcon from '@/components/Icons/DialpadIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import CountUpTimer from '@/components/CountUpTimer.vue'
import useCall from '@/composables/call'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { Avatar, call } from 'frappe-ui'
import { onMounted, ref } from 'vue'
import NoteModal from './NoteModal.vue'

let {
  _call,
  onCall,
  calling,
  muted,
  counterUp,
  callStatus,
  showCallPopup,
  showSmallCallWindow,
  callPopup,
  contact,
  toggleMute,
  acceptIncomingCall,
  rejectIncomingCall,
  hangUpCall,
  cancelCall,
  startupClient,
  toggleCallWindow,
} = useCall()

const showNoteModal = ref(false)
const note = ref({
  title: '',
  content: '',
})

async function updateNote(_note) {
  if (_note.name) {
    await call('frappe.client.set_value', {
      doctype: 'CRM Note',
      name: _note.name,
      fieldname: _note,
    })
    note.value = _note
  } else {
    let d = await call('frappe.client.insert', {
      doc: {
        doctype: 'CRM Note',
        title: _note.title,
        content: _note.content,
      },
    })
    if (d.name) {
      note.value = d
      await call('crm.twilio.api.add_note_to_call_log', {
        call_sid: _call.value.parameters.CallSid,
        note: d.name,
      })
    }
  }
}

const { width, height } = useWindowSize()

let { style } = useDraggable(callPopup, {
  initialValue: { x: width.value - 280, y: height.value - 310 },
  preventDefault: true,
})

onMounted(() => startupClient())
</script>

<style scoped>
.pulse::before {
  content: '';
  position: absolute;
  border: 1px solid green;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  border-radius: 50%;
  animation: pulse 1s linear infinite;
}

.pulse::after {
  content: '';
  position: absolute;
  border: 1px solid green;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  border-radius: 50%;
  animation: pulse 1s linear infinite;
  animation-delay: 0.3s;
}

@keyframes pulse {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }

  50% {
    transform: scale(1);
    opacity: 1;
  }

  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}
</style>

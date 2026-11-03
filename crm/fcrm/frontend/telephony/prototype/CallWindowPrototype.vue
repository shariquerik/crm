<!--
  PROTOTYPE (#46115), throwaway: the call window's content inside desk v2's standing frame.
  Three layouts (?variant=A|B|C) × Twilio/Exotel × picker, incoming, ringing, on call, ended.
  No server calls; Note and Task open the real `shell.create` (Quick Entry) on a sample lead.
-->
<template>
  <!-- Picker step (map ruling 12): one button per medium and a remember check. -->
  <div v-if="s.step === 'picker'" class="flex flex-col gap-3">
    <ContactRow :contact="contact" />
    <div class="flex flex-col gap-2">
      <div class="text-p-sm text-ink-gray-5">{{ __('Call with') }}</div>
      <Button
        v-for="m in MEDIA"
        :key="m"
        class="w-full"
        :label="m"
        icon-left="lucide-phone"
        @click="choose(m)"
      />
    </div>
    <Checkbox v-model="s.remember" :label="__('Remember my choice')" />
  </div>

  <!-- A: every control is a frame action; the content is only who and how long. -->
  <div v-else-if="s.variant === 'A'" class="flex flex-col gap-3">
    <ContactRow :contact="contact" :status="statusText" />
    <div v-if="overflow.length" class="flex gap-2">
      <Button
        v-for="a in overflow"
        :key="a.label"
        class="flex-1"
        size="sm"
        :label="a.label"
        :icon-left="a.icon"
        @click="a.run"
      />
    </div>
  </div>

  <!-- B: the frame holds only the call controls; Note, Task and the record sit in a footer. -->
  <div v-else-if="s.variant === 'B'" class="flex flex-col gap-3">
    <ContactRow :contact="contact" :status="statusText" />
    <div v-if="showSecondary" class="flex gap-1.5 border-t border-outline-gray-1 pt-3">
      <Button
        v-for="a in secondary"
        :key="a.label"
        class="min-w-0 flex-1"
        size="sm"
        :label="a.label"
        @click="a.run"
      />
    </div>
  </div>

  <!-- C: a phone card; round buttons in the content, frame actions only on the pill. -->
  <div v-else class="flex flex-col items-center text-center" :class="roomy ? 'gap-4 pb-1 pt-2' : 'gap-3 pt-1'">
    <div class="rounded-full" :class="{ 'p46115-ring': ringing && proto.motion === 'on' }">
      <Avatar :label="contact.name || '#'" size="3xl" shape="circle" />
    </div>
    <div class="flex min-w-0 max-w-full flex-col" :class="roomy ? 'gap-1.5' : 'gap-1'">
      <div class="truncate text-lg font-medium text-ink-gray-8">
        {{ contact.name || contact.number }}
      </div>
      <div class="truncate text-p-sm text-ink-gray-5">
        {{ contact.name ? contact.number : contact.record?.doctype || __('Unknown number') }}
      </div>
    </div>
    <div
      v-if="s.step === 'oncall' || s.step === 'ended'"
      class="text-base tabular-nums transition-colors duration-300"
      :class="s.step === 'ended' ? 'text-ink-gray-5' : 'text-ink-gray-7'"
    >
      {{ clock }}
    </div>
    <TransitionGroup
      tag="div"
      class="flex items-center justify-center"
      :class="roomy ? 'gap-3' : 'gap-2'"
      :css="proto.motion === 'on'"
      enter-active-class="overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none"
      :enter-from-class="collapsed"
      leave-active-class="overflow-hidden transition-all duration-200 ease-in motion-reduce:transition-none"
      :leave-to-class="collapsed"
    >
      <div v-for="a in cardButtons" :key="a.label" class="w-9">
      <Tooltip :text="a.label">
        <Button
          class="!size-9 !rounded-full"
          :class="proto.look === '3' && !a.theme ? '!bg-surface-white shadow-sm hover:!bg-surface-gray-2' : ''"
          :icon="a.icon"
          :label="a.label"
          :variant="a.theme ? 'solid' : 'subtle'"
          :theme="a.theme || 'gray'"
          @click="a.run"
        />
      </Tooltip>
      </div>
    </TransitionGroup>
  </div>

  <!-- The prototype's own bar, not part of the design under review. -->
  <Teleport to="body">
    <div
      class="pointer-events-auto fixed left-1/2 top-2 z-[9999] flex max-w-[95vw] whitespace-nowrap -translate-x-1/2 flex-col items-center gap-1 rounded-6 px-3 py-2 text-xs text-white shadow-2xl"
      style="background: #111; font-family: ui-monospace, monospace"
      data-prototype-bar
    >
      <div class="flex items-center gap-2">
        <button
          v-for="m in MEDIA"
          :key="m"
          :class="s.medium === m ? 'underline' : 'opacity-60'"
          @click="go({ medium: m })"
        >
          {{ m }}
        </button>
        <span class="opacity-40">|</span>
        <button
          v-for="st in STEPS"
          :key="st"
          :class="s.step === st ? 'underline' : 'opacity-60'"
          @click="go({ step: st })"
        >
          {{ st }}
        </button>
        <span class="opacity-40">|</span>
        <button @click="s.pillTime = !s.pillTime">pill: {{ s.pillTime ? 'name · time' : 'name' }}</button>
        <button @click="go({ known: !s.known })">{{ s.known ? 'known' : 'unknown' }}</button>
        <span class="opacity-40">|</span>
        <button @click="proto.motion = proto.motion === 'on' ? 'off' : 'on'">motion: {{ proto.motion }}</button>
        <span class="opacity-40">|</span>
        <button @click="win.state === 'open' ? win.minimise() : win.open()">
          {{ win.state }}
        </button>
      </div>
      <div class="opacity-70">
        title "{{ title }}" · actions [{{ frameActions.map((a) => a.label).join(', ') }}] ·
        closable {{ closable }}
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, reactive, watch, watchEffect } from 'vue'
import { Avatar, Button, Checkbox, Tooltip } from 'frappe-ui'
import { routeFor } from '@shell'
import { __ } from 'frappe/i18n'

const props = defineProps({ shell: Object, window: Object })

const MEDIA = ['Twilio', 'Exotel']
const STEPS = ['picker', 'incoming', 'ringing', 'oncall', 'ended']
const VARIANTS = { A: 'Frame actions', B: 'Footer buttons', C: 'Phone card' }
const LEAD = { doctype: 'CRM Lead', name: 'CRM-LEAD-2026-00002', label: 'Lead' }

const url = new URLSearchParams(location.search)
const LOOKS = { 1: 'white', 2: 'gray-3 border', 3: 'gray body', 4: 'dark', 5: 'shadow only', 6: 'gray header' }
const WIDTHS = [240, 260, 280]
const width = Number(url.get('w')) || 240
// The frame reads the same object (prototype patch in StandingWindowFrame.vue).
const proto = (window.__p46115 ??= reactive({ look: url.get('look') || '1', space: url.get('space') || 'roomy', motion: url.get('motion') || 'on' }))
const ringing = computed(() => s.step === 'incoming' || s.step === 'ringing')
// A button leaving or arriving takes its width and its gap with it, so the row re-centres smoothly.
const collapsed = computed(() => `!w-0 scale-75 opacity-0 ${roomy.value ? '-mr-3' : '-mr-2'}`)
const roomy = computed(() => proto.space === 'roomy')
const s = reactive({
  variant: url.get('variant') || 'C',
  medium: url.get('medium') || 'Twilio',
  step: url.get('step') || 'oncall',
  known: url.get('known') !== '0',
  pillTime: url.get('pill') !== '0',
  muted: false,
  remember: false,
  seconds: 42,
})

const contact = computed(() =>
  s.known
    ? { name: 'Alice Johnson', number: '+1 555 000 1234', record: LEAD }
    : { name: '', number: '+1 555 000 9999', record: null },
)
const title = computed(() => contact.value.name || contact.value.number)
const twilio = computed(() => s.medium === 'Twilio')
const clock = computed(
  () => `${String(Math.floor(s.seconds / 60)).padStart(2, '0')}:${String(s.seconds % 60).padStart(2, '0')}`,
)
const statusText = computed(() => {
  if (s.step === 'picker') return __('Call with')
  if (s.step === 'incoming') return twilio.value ? __('Incoming call') : __('Incoming call · on your phone')
  if (s.step === 'ringing') return twilio.value ? __('Calling…') : __('Ringing your phone…')
  if (s.step === 'oncall') return s.muted ? `${__('Muted')} · ${clock.value}` : clock.value
  return `${__('Call ended')} · ${clock.value}`
})

const timer = setInterval(() => s.step === 'oncall' && s.seconds++, 1000)
onBeforeUnmount(() => clearInterval(timer))

// The call controls, by medium and step. Exotel has none: its call lives on the agent's phone.
const act = {
  accept: { label: __('Accept'), icon: 'lucide-phone', theme: 'green', run: () => go({ step: 'oncall' }) },
  reject: { label: __('Reject'), icon: 'lucide-phone-off', theme: 'red', run: () => props.window.close() },
  cancel: { label: __('Cancel'), icon: 'lucide-phone-off', theme: 'red', run: () => props.window.close() },
  hangUp: { label: __('Hang up'), icon: 'lucide-phone-off', theme: 'red', run: () => go({ step: 'ended' }) },
}
const mute = computed(() => ({
  label: s.muted ? __('Unmute') : __('Mute'),
  icon: s.muted ? 'lucide-mic-off' : 'lucide-mic',
  run: () => (s.muted = !s.muted),
}))
const note = { label: __('Note'), icon: 'lucide-notebook-pen', run: () => create('FCRM Note') }
const task = { label: __('Task'), icon: 'lucide-square-check', run: () => create('CRM Task') }
const open = computed(() =>
  contact.value.record
    ? { label: contact.value.record.label, icon: 'lucide-arrow-up-right', run: openRecord }
    : null,
)
const secondary = computed(() => [note, task, open.value].filter(Boolean))
const showSecondary = computed(() => s.step === 'oncall' || s.step === 'ended')

const controls = computed(() => {
  if (!twilio.value) return []
  if (s.step === 'incoming') return [act.accept, act.reject]
  if (s.step === 'ringing') return [act.cancel]
  if (s.step === 'oncall') return [mute.value, act.hangUp]
  return []
})

// A: controls first, then fill the three slots with Note, Task, record; the rest goes in the content.
const variantA = computed(() => {
  const extras = showSecondary.value ? secondary.value : open.value ? [open.value] : []
  const room = 3 - controls.value.length
  return { frame: [...extras.slice(0, room), ...controls.value], overflow: extras.slice(room) }
})
const overflow = computed(() => variantA.value.overflow)
const cardButtons = computed(() => [
  ...(s.step === 'oncall' && twilio.value ? [mute.value] : []),
  ...(showSecondary.value ? secondary.value : []),
  ...controls.value.filter((a) => a !== mute.value),
])

const frameActions = computed(() => {
  if (s.step === 'picker') return []
  if (s.variant === 'A') return variantA.value.frame
  if (s.variant === 'B') return controls.value
  // C: the open card draws its own buttons; the pill gets the call controls (or the record).
  if (props.window.state !== 'minimised') return []
  return controls.value.length ? controls.value.slice(-3) : open.value ? [open.value] : []
})
const closable = computed(() => s.step === 'picker' || s.step === 'ended')

watchEffect(() => {
  const short = { incoming: __('Incoming'), ringing: __('Calling…'), oncall: clock.value, ended: __('Ended') }
  const minimised = props.window.state === 'minimised'
  const pill = s.pillTime && minimised && short[s.step]
  // C: the card shows the name, so the open frame's title is the call's state.
  const state = { incoming: __('Incoming call'), ringing: twilio.value ? __('Calling…') : __('Ringing your phone…'), oncall: __('On call'), ended: __('Call ended') }
  props.window.setTitle(
    s.step === 'picker' ? `${__('Call')} ${title.value}`
      : s.variant === 'C' && !minimised ? state[s.step]
      : pill ? `${title.value} · ${pill}` : title.value,
  )
  props.window.setActions(frameActions.value)
  props.window.setClosable(closable.value)
})
watch(
  () => [s.variant, s.medium, s.step, s.known, s.pillTime, proto.look, proto.space, proto.motion],
  () => {
    const q = new URLSearchParams(location.search)
    Object.entries({ variant: s.variant, medium: s.medium, step: s.step, known: s.known ? 1 : 0, pill: s.pillTime ? 1 : 0, look: proto.look, space: proto.space, motion: proto.motion }).forEach(
      ([k, v]) => q.set(k, v),
    )
    history.replaceState(history.state, '', `${location.pathname}?${q}${location.hash}`)
  },
)

function go(patch) {
  Object.assign(s, patch)
  if (patch.step === 'oncall' || patch.step === 'ringing' || patch.step === 'incoming') s.muted = false
  props.window.open()
}
// The width is fixed when the window attaches, so a new width is a reload with ?w=.
function reloadWidth(px) {
  const q = new URLSearchParams(location.search)
  q.set('w', px)
  location.search = q
}
function choose(medium) {
  go({ medium, step: 'ringing' })
}
function cycle(by) {
  const keys = Object.keys(VARIANTS)
  s.variant = keys[(keys.indexOf(s.variant) + by + keys.length) % keys.length]
}
function create(doctype) {
  const ref = contact.value.record
  const values = ref ? { reference_doctype: ref.doctype, reference_docname: ref.name } : {}
  if (doctype === 'CRM Task') values.title = `${__('Follow up with')} ${title.value}`
  return props.shell.create(doctype, { values })
}
function openRecord() {
  const ref = contact.value.record
  return props.shell.router.push(routeFor(ref.doctype, ref.name))
}

function onKey(e) {
  if (e.target.closest?.('input, textarea, [contenteditable]')) return
  if (e.key === 'ArrowLeft' && e.altKey) cycle(-1)
  if (e.key === 'ArrowRight' && e.altKey) cycle(1)
}
addEventListener('keydown', onKey)
onBeforeUnmount(() => removeEventListener('keydown', onKey))

const win = props.window

const ContactRow = defineComponent({
  props: { contact: Object, status: String },
  setup: (p) => () =>
    h('div', { class: 'flex flex-col gap-2.5' }, [
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { label: p.contact.name || '#', size: 'xl', shape: 'circle' }),
        h('div', { class: 'flex min-w-0 flex-col gap-1' }, [
          h('div', { class: 'truncate text-base font-medium text-ink-gray-8' }, p.contact.name || p.contact.number),
          h('div', { class: 'truncate text-p-sm text-ink-gray-5' }, p.contact.name ? p.contact.number : __('Unknown number')),
        ]),
      ]),
      p.status && h('div', { class: 'text-base tabular-nums text-ink-gray-7' }, p.status),
    ]),
})
</script>

<style>
/* PROTOTYPE (#46115): a soft gray ring while the call rings. */
@media (prefers-reduced-motion: no-preference) {
  .p46115-ring {
    animation: p46115-ring 1.6s ease-out infinite;
  }
}
@keyframes p46115-ring {
  from {
    box-shadow: 0 0 0 0 var(--outline-gray-3);
  }
  to {
    box-shadow: 0 0 0 10px transparent;
  }
}
</style>

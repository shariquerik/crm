# Research: CRM v1's telephony on desk v2's terms

Ticket: [frappe/frappe#46111](https://github.com/frappe/frappe/issues/46111), map [#46110](https://github.com/frappe/frappe/issues/46110).

Sources, read on 2026-11-01:

- frappe/crm `desk-v2` at `ab34dc43c`. Paths below are from the crm repo root.
- frappe/frappe `desk-v2` at `8ba94d3d78` (`frontend/src/shell/`).
- `@twilio/voice-sdk` as installed in `crm/frontend/node_modules`.
- The charter rulings on #46022 (11–20) and #46110 (Notes).

This file records what v1 does. It makes no design choice. The open questions are at the end.

## 1. The parts of v1

| Part | File | Job |
|---|---|---|
| `CallUI` | `frontend/src/components/Telephony/CallUI.vue` | Mounts both call UIs. Runs their `setup()`. Registers `makeCall(number)` in the global store. Shows the "Make Call" dialog to pick a medium. |
| `TwilioCallUI` | `.../Telephony/TwilioCallUI.vue` | Browser softphone. Owns the Twilio `Device`. Draggable `w-60` popup and a small pill. |
| `ExotelCallUI` | `.../Telephony/ExotelCallUI.vue` | Call status popup only. The audio is on the agent's phone. Draggable `w-[280px]` popup and a small pill, with inline note and task. |
| `TaskPanel` | `.../Telephony/TaskPanel.vue` | Inline task form in the Exotel popup: title, description (`RichTextField`), status, priority, assignee (`Link` to User), due date. It makes no request itself. |
| `useTelephony` | `frontend/src/composables/telephony.js` | One cached `createResource` on `crm.integrations.api.is_call_integration_enabled`, `auto: true`. Exposes `isEnabled`, `isAnyEnabled`, `defaultCallingMedium`. |
| `globalStore` | `frontend/src/stores/global.js` | Holds `makeCall` and `setMakeCall`, and `$socket`. |
| Server, shared | `crm/integrations/api.py` | Medium check, default medium, note and task links, contact lookup, recording proxy. |
| Server, Twilio | `crm/integrations/twilio/{api,twilio_handler,utils}.py` | Access token, TwiML webhooks, call log, status callbacks. |
| Server, Exotel | `crm/integrations/exotel/handler.py` | Outgoing call request, webhook, call log, realtime event. |

`CallUI` mounts in `components/Layouts/AppHeader.vue:5` and `components/Mobile/MobileAppHeader.vue:14`. Callers of `makeCall(number)`: the Lead, Deal and Contact pages, `MobileContact.vue`, `ActivityHeader.vue`, and the Leads and Deals lists.

## 2. Call flows

### 2.1 Choose the medium (both)

`makeCall(number)` in `CallUI.vue`:

1. If more than one medium is enabled and the user has no default medium, show the "Make Call" dialog. The dialog has the number, a Twilio/Exotel select, and "Make {0} as default calling medium".
2. Else use the default medium, or the first enabled medium.
3. If the user checks the default box, call `crm.integrations.api.set_default_calling_medium(medium)`. It creates or updates the user's `CRM Telephony Agent` row (`ignore_permissions=True`).
4. Call `makeOutgoingCall(number)` on the Twilio or Exotel component.

### 2.2 Twilio

The Twilio flows use the Twilio Voice SDK and Twilio's webhooks. **They use no Frappe realtime event.** Call status reaches the browser over the SDK's own signaling.

| Flow | Browser | Server and Twilio |
|---|---|---|
| Register | `setup()` calls `crm.integrations.twilio.api.generate_access_token`, then `new Device(token, {codecPreferences: ['opus','pcmu'], fakeLocalDTMF: true, enableRingingState: true})`, then `device.register()`. On `tokenWillExpire` it gets a new token and calls `device.updateToken`. | The method returns `{ok: false, error: "caller_phone_identity_missing"}` if the user's agent row has no `twilio_number`. Else it returns a JWT with identity = user email with `@` changed to `(at)`, TTL 1 hour, and a `VoiceGrant` with `outgoing_application_sid = twiml_sid` and `incoming_allow=True`. |
| Outgoing | `device.connect({params: {To: number}})`. It listens to `accept`, `messageReceived`, `disconnect` and `cancel`. Shows "Initiating call…", then "Ringing…"/"Calling…". Starts the timer when `CallStatus == 'in-progress'`. | Twilio calls the TwiML app's webhook `crm.integrations.twilio.api.voice` (guest, signature checked by `validate_twilio_request`). It maps the caller identity to the agent's `twilio_number`, creates the `CRM Call Log` and links it to the lead, deal or contact. It returns a `<Dial>` with status and recording callbacks. |
| Status | `_call.on('messageReceived')` reads `message.content.CallStatus`. | `update_call_status_info` (guest) updates the call log. Then it sends the status to the browser with `client.calls(ParentCallSid).user_defined_messages.create(...)`. Only the SDK call on the other end gets it. |
| Recording | — | `update_recording_info` (guest) stores `recording_url` on the call log. |
| Incoming | `device.on('incoming')` stores the call and opens the popup with "Incoming call…". | `twilio_incoming_call_handler` (guest) creates the call log. `IncomingCall.process()` finds the agents whose `twilio_number` is the called number. It keeps those with a row in `tabSessions`. If many, it prefers the lead or deal owner of the caller's number. If the agent's `call_receiving_device` is `Phone`, it dials the agent's `User.mobile_no`. Else it dials `<Client>` with the agent identity. |
| Accept | `_call.accept()`, timer starts. | — |
| Reject | `_call.reject()`, popup closes. | — |
| Hang up | `_call.disconnect()`. "Cancel" does the same while ringing out. | Twilio sends the last status callback. |
| Mute | `_call.mute()` / `_call.mute(false)`. | — |
| Note | `openNoteModal()` opens v1's `useDoctypeModal` with `doctype: 'CRM Call Log'`. `afterInsert` calls `crm.integrations.api.add_note_to_call_log(call_sid, note)`. | Creates or updates an `FCRM Note` and links it to the call log. Needs `write` on the call log. |
| Task | None. The Twilio popup has no task button. | — |
| Contact | `crm.integrations.api.get_contact_by_phone_number(phone_number)` gives the name and image. | — |

The `<Client>` dial rings every registered device with the agent's identity. Each tab registers one device, so every tab rings (#45837 Q9).

The note modal passes `doctype: 'CRM Call Log'` but the callback sends the result as a note. This looks inconsistent. A build must check what the modal really creates.

### 2.3 Exotel

Exotel rings the agent's own phone. The browser has no audio, no accept, no reject, no hang-up and no mute. It shows status only.

| Flow | Browser | Server and Exotel |
|---|---|---|
| Subscribe | `setup()` runs `$socket.on('exotel_call', …)`. | — |
| Outgoing | `makeOutgoingCall(number)` calls `crm.integrations.exotel.handler.make_a_call(to_number)`. It opens the popup with "Calling…". It warns if `call_log_creation_failed`. | Reads `mobile_no` and `exotel_number` from the agent row. Checks that `exotel_number` is one of the account's ExoPhones (one more HTTP request to Exotel). Posts `Calls/connect.json` with `StatusCallback = handle_request?key=<token>&agent=<user>`. Creates the outgoing `CRM Call Log`. |
| Incoming | The handler opens the popup if `data.AgentEmail == user`. | Exotel's passthru applet calls `handle_request?key=<token>`. |
| Status (both) | `updateStatus(data)` maps the payload to "Ringing…", "In progress", "No answer", "Call ended", "Incoming call". It starts and stops the timer. | `handle_request` (guest, checks `key`) logs the request, then `frappe.publish_realtime("exotel_call", call_payload)` at `handler.py:41`. Then it creates or updates the call log. |
| Close | "Close" shows only after "Call ended" or "No answer". It resets note and task. | — |
| Note | Inline `RichTextField`. "Save"/"Update" calls `crm.integrations.api.add_note_to_call_log(call_sid, note)`. | Creates or updates the `FCRM Note` and links it. |
| Task | Inline `TaskPanel`. "Save"/"Update" calls `crm.integrations.api.add_task_to_call_log(call_sid, task)`. | Creates or updates the `CRM Task` and links it. Needs `write` on the call log. |
| Lead or deal | A "Deal" or "Lead" button routes to the record from the contact lookup. | — |

**Who receives `exotel_call`.** The call to `publish_realtime` has no `user=`, `room=` or `doctype=`. Every connected user gets each event. The payload holds the phone numbers and `AgentEmail`. The browser filter only decides whether to open the popup. It does not drop the event. `callData`, `callStatus` and the timer change for every event, also for another agent's call. Thus an agent with an open popup can see another agent's status.

The target user is known on the server for both directions:

- Incoming: `AgentEmail` in the payload.
- Outgoing: `frappe.request.args.get("agent")`, from the status callback URL.

Charter ruling 3 (`publish_realtime(..., user=…)`) can use these two values.

`event_notification` (`crm/api/event.py:372`) also has no `user=`. It is an event reminder, not a call event.

## 3. How v1 decides that a user has a calling medium

`is_call_integration_enabled` returns the site settings and the user's default:

```python
{"integrations": {"twilio": CRM Twilio Settings.enabled, "exotel": CRM Exotel Settings.enabled},
 "default_calling_medium": CRM Telephony Agent[session.user].default_medium or None}
```

It does **not** check the user. v1 runs `setup()` for every user when a medium is enabled on the site:

- Twilio `setup()` asks for a token. A user with no `twilio_number` gets `{ok: false}`. `new Device(undefined)` then fails, and v1 logs it to the console.
- Exotel `setup()` subscribes every user to `exotel_call`.

The per-user facts live on `CRM Telephony Agent` (named by `user`). Its fields: `user`, `mobile_no`, `user_name`, `exotel_number`, `twilio_number`, `phone_nos` (table), `default_medium` (`Twilio`/`Exotel`), `call_receiving_device` (`Computer`/`Phone`). Read permission: System Manager, Sales Manager, Sales User. The server reads this data in these places:

| Medium | Needed to call out | Needed to ring in the browser |
|---|---|---|
| Twilio | Settings `enabled`, agent `twilio_number` (`generate_access_token`, `voice`) | The above, and `call_receiving_device == 'Computer'`, and a session row |
| Exotel | Settings `enabled`, agent `exotel_number` and `mobile_no` (`make_a_call`) | No browser ring. The popup needs the realtime event only. |

One request at idle (charter ruling 4) can return per medium: the site flag, and whether the user's agent row has the fields above. It can also return `default_medium`. All are reads of two singles and one agent row. No current method returns them together.

## 4. The Twilio Voice SDK

- Package: `@twilio/voice-sdk`. `frontend/package.json:22` asks for `^2.10.2`. `yarn.lock` resolves **2.18.1**, and the installed `package.json` says 2.18.1.
- Runtime dependencies: `@twilio/voice-errors` 1.7.0, `events` 3.3.0, `loglevel` 1.9.2, `tslib` 2.8.1.
- Size: the package ships a minified bundle with all dependencies, `dist/twilio.min.js`. **301,767 bytes minified, 65,477 bytes gzipped** (`wc -c`, and `gzip -9c | wc -c`). The unminified `dist/twilio.js` is 526,680 bytes, 105,585 gzipped.
- Method note: Vite bundles the ESM entry (`esm/twilio.js`), not `dist/`. I did not run a bundler, because the crm frontend has no `esbuild` binary and the ticket says do not build. The real lazy chunk can be smaller after tree-shaking. A build ticket measures the chunk in its own build output.
- v1 imports `Device` statically at the top of `TwilioCallUI.vue`. So the SDK is in the main CRM chunk now. Charter ruling 4 makes it a lazy chunk.
- Registration: see 2.2, "Register". The token TTL is one hour. v1 refreshes on `tokenWillExpire`.

## 5. v1 mapped to desk v2

### 5.1 The API that desk v2 gives

From `frontend/src/shell/shellHooks.ts`, `standingWindows.ts` and `StandingWindowFrame.vue`:

- `shell.window(component, {icon, width})` mounts the component at once, closed, for the life of the tab. A second call warns and returns `undefined`.
- The component gets two props: `window` (the handle) and `shell` (the act `Shell`: `router`, `toast`, `call`, `run`, `create`, `openSettings`, `dialog`).
- The handle: `state` (`closed`/`open`/`minimised`, reactive), `open()`, `minimise()`, `close()`, `setTitle(text)`, `setActions([{label, icon, theme, run}])` (first three drawn), `setClosable(bool)`.
- Width is clamped to 240–400px, default 280. No drag. Height follows the content. `open()` does not move focus. Nothing is kept across reloads.
- Acts: CRM's `crm/fcrm/frontend/acts.js` has `log_a_call` (`shell.create('CRM Call Log')`). An act `run(shell, value)` can take a value through `shell.run(name, value)`.

### 5.2 The map

| v1 part | desk v2 place |
|---|---|
| `CallUI` mounted in `AppHeader` | `setup(shell)` in `crm/fcrm/frontend/shell.js` calls `shell.window(...)` once, after the idle medium check (ruling 4). |
| `isAnyEnabled` watch that runs `setup()` | The same `setup(shell)`, at idle. |
| `setMakeCall` / `globalStore.makeCall(number)` | The act `shell.crm.make_a_call` with the number as its value (#45837 Q8). The act and the window share state in CRM's code. |
| "Make Call" medium dialog | `shell.dialog` from the act, or the window content. Not decided (question 3). |
| `set_default_calling_medium` | No change. A server method. |
| Popup visible / hidden (`showCallPopup`) | `window.open()` / `window.close()`. |
| Small pill (`showSmallCallWindow`, `toggleCallWindow`, Minimize button) | `window.minimise()`. The shell draws the minimised form and always offers minimise. |
| Contact name on the popup and pill | `window.setTitle(name or number)`. |
| Twilio buttons: Accept, Reject / Cancel / Mute, Note, Hang Up | `window.setActions(...)`, up to three per state. Ringing in: Accept, Reject. Ringing out: Cancel. On call: Mute, Note, Hang Up. Each state has three or fewer. |
| Pill hang-up button | The same actions. The shell draws them in the minimised form (ruling 14). |
| Exotel "Close" only after the call ends | `window.setClosable(false)` while the call runs, `true` after. |
| Exotel buttons: Note, Task, Deal/Lead, Save/Update, Minimize, Close | Four or five buttons. More than three. Some must go in the content (question 4). |
| Twilio `w-60` (240px) | `width: 240` is in range. |
| Exotel `w-[280px]`, about 290px with note and task | `width: 280` (default) to about 290. In range. |
| Twilio note via `useDoctypeModal` | `shell.create('FCRM Note', {values})`, then `add_note_to_call_log` (ruling 7). |
| Exotel inline note and `TaskPanel` | `shell.create('FCRM Note' / 'CRM Task', {values})` (ruling 7), or inline content in the window. Not decided (question 5). |
| Deal/Lead button (`router.push`) | `shell.router.push(...)` from the window's `shell` prop. |
| `$socket.on('exotel_call')` | The component imports `@framework/ui/socket` itself (#45837 Q7). |
| `useDraggable` initial position | No place. Ruling 16: no drag. |
| `updateWindowHeight` (moves the popup up 224px for note or task) | No place. The shell sizes the frame to the content. |
| Pulse and blink animations, timer | Window content. |
| `useTelemetry` `capture(...)`, `useOnboarding` step | No place in the shell API. CRM's code calls them, if they exist on desk v2. |
| `MobileAppHeader` mount | No place. Ruling 5: the desktop row on a phone. |

### 5.3 What has no place

- Drag and the remembered position.
- A popup that changes its own height and position.
- More than three header actions (Exotel).
- A focus move on an incoming call. `open()` does not move focus. The `aria-live` title announces it.
- A call that survives a reload or a prefix switch. Ruling 20 and #46022 ruling 14: the window starts closed after a full load. A Twilio call in progress ends on a reload.
- A browser filter for `exotel_call`. Ruling 3 moves it to the server.

## 6. Questions for the owner

1. The idle medium check (ruling 4): add a new whitelisted method, or change `is_call_integration_enabled`? `/crm` also reads the current method.
2. The Exotel window has no browser audio. Does an Exotel user get the window at idle, or only when the first `exotel_call` event or `make_a_call` arrives?
3. The "Make Call" medium dialog: `shell.dialog` from the act, or a step in the window content?
4. The Exotel window needs Note, Task, Deal/Lead, Save/Update and Close. Which three go in `setActions`, and which move into the content?
5. Exotel's inline note and task: keep them inline in the window, or move them to `shell.create` (ruling 7)? Ruling 7 names `create` for "the in-call note and task", but Exotel's inline form is the main reason for its 280–290px width.
6. The Twilio note modal passes `doctype: 'CRM Call Log'` (2.2). Is this a v1 bug that the build fixes, or the intended record?

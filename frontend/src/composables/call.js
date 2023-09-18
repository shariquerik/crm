import { Device } from '@twilio/voice-sdk'
import { contactsStore } from '@/stores/contacts'
import { call } from 'frappe-ui'
import { ref } from 'vue'

export default function useCall() {
  const { getContact } = contactsStore()

  let device = ''
  let token = ref('')
  let _call = ref(null)
  const contact = ref({
    full_name: '',
    mobile_no: '',
  })

  let showCallPopup = ref(false)
  let showSmallCallWindow = ref(false)
  let onCall = ref(false)
  let calling = ref(false)
  let muted = ref(false)
  let callPopup = ref(null)
  let counterUp = ref(null)
  let callStatus = ref('')

  async function startupClient() {
    console.log('Requesting Access Token...')

    try {
      const data = await call('crm.twilio.api.generate_access_token')
      console.log('Got a token.')
      token.value = data.token
      intitializeDevice(data.token)
    } catch (err) {
      console.log('An error occurred. ' + err.message)
    }
  }

  function intitializeDevice(token) {
    device = new Device(token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      enableRingingState: true,
    })

    addDeviceListeners()

    device.register()
  }

  function addDeviceListeners() {
    device.on('registered', () => {
      console.log('Ready to make and receive calls!')
    })

    device.on('unregistered', (device) => {
      console.log('Logged out')
    })

    device.on('error', (error) => {
      console.log('Twilio.Device Error: ' + error.message)
    })

    device.on('incoming', handleIncomingCall)

    device.on('tokenWillExpire', async () => {
      const data = await call('crm.twilio.api.generate_access_token')
      device.updateToken(data.token)
    })
  }

  function toggleMute() {
    if (_call.value.isMuted()) {
      _call.value.mute(false)
      muted.value = false
    } else {
      _call.value.mute()
      muted.value = true
    }
  }

  function handleIncomingCall(call) {
    console.log('Incoming call from ' + call.parameters.From)

    // get name of the caller from the phone number

    contact.value = getContact(call.parameters.From)

    if (!contact.value) {
      contact.value = {
        full_name: 'Unknown',
        mobile_no: call.parameters.From,
      }
    }

    showCallPopup.value = true
    _call.value = call

    _call.value.on('accept', (conn) => {
      console.log('conn', conn)
    })

    // add event listener to call object
    call.on('cancel', handleDisconnectedIncomingCall)
    call.on('disconnect', handleDisconnectedIncomingCall)
    call.on('reject', handleDisconnectedIncomingCall)
  }

  async function acceptIncomingCall() {
    console.log('Accepted incoming call.')
    onCall.value = true
    await _call.value.accept()
    counterUp.value.start()
  }

  function rejectIncomingCall() {
    _call.value.reject()
    console.log('Rejected incoming call')
    showCallPopup.value = false
    if (showSmallCallWindow.value == undefined) {
      showSmallCallWindow = false
    } else {
      showSmallCallWindow.value = false
    }
    callStatus.value = ''
    muted.value = false
  }

  function hangUpCall() {
    _call.value.disconnect()
    console.log('Hanging up incoming call')
    onCall.value = false
    callStatus.value = ''
    muted.value = false
    note.value = {
      title: '',
      content: '',
    }
    counterUp.value.stop()
  }

  function handleDisconnectedIncomingCall() {
    console.log('Call ended.')
    showCallPopup.value = false
    if (showSmallCallWindow.value == undefined) {
      showSmallCallWindow = false
    } else {
      showSmallCallWindow.value = false
    }
    _call.value = null
    muted.value = false
    onCall.value = false
    counterUp.value.stop()
  }

  async function makeOutgoingCall(number) {
    contact.value = getContact(number)

    if (device) {
      console.log('Attempting to call ' + contact.value.mobile_no + '...')

      try {
        _call.value = await device.connect({
          params: { To: contact.value.mobile_no },
        })

        _call.value.on('messageReceived', (message) => {
          let info = message.content
          callStatus.value = info.CallStatus

          console.log('Call status: ' + info.CallStatus)

          if (info.CallStatus == 'in-progress') {
            console.log('Call in progress.')
            calling.value = false
            onCall.value = true
            counterUp.value.start()
          }
        })

        _call.value.on('accept', () => {
          console.log('Initiated call!')
          showCallPopup.value = true
          calling.value = true
          onCall.value = false
        })
        _call.value.on('disconnect', (conn) => {
          console.log('Call ended.')
          calling.value = false
          onCall.value = false
          showCallPopup.value = false
          showSmallCallWindow = false
          _call.value = null
          callStatus.value = ''
          muted.value = false
          counterUp.value.stop()
          note.value = {
            title: '',
            content: '',
          }
        })
        _call.value.on('cancel', () => {
          console.log('Call ended.')
          calling.value = false
          onCall.value = false
          showCallPopup.value = false
          showSmallCallWindow = false
          _call.value = null
          callStatus.value = ''
          muted.value = false
          note.value = {
            title: '',
            content: '',
          }
          counterUp.value.stop()
        })
      } catch (error) {
        console.log('Could not connect call: ' + error.message)
      }
    } else {
      console.log('Unable to make call.')
    }
  }

  function cancelCall() {
    _call.value.disconnect()
    showCallPopup.value = false
    if (showSmallCallWindow.value == undefined) {
      showSmallCallWindow = false
    } else {
      showSmallCallWindow.value = false
    }
    calling.value = false
    onCall.value = false
    callStatus.value = ''
    muted.value = false
    note.value = {
      title: '',
      content: '',
    }
  }

  function toggleCallWindow() {
    showCallPopup.value = !showCallPopup.value
    if (showSmallCallWindow.value == undefined) {
      showSmallCallWindow = !showSmallCallWindow
    } else {
      showSmallCallWindow.value = !showSmallCallWindow.value
    }
  }

  return {
    token,
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
    makeOutgoingCall,
  }
}

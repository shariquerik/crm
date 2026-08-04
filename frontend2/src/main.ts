import '@/index.css'

import { createApp } from 'vue'
import { FrappeUI, frappeRequest, setConfig } from 'frappe-ui'
import { spritePlugin } from 'frappe-ui/icons'

import router from '@/router'

setConfig('resourceFetcher', frappeRequest)

declare const __SOCKETIO_PORT__: number
declare global {
  interface Window {
    socketio_port?: number
  }
}

// initSocket defaults to 9000 and never reads window.socketio_port, so a bench on
// any other port gets a socket that silently never connects.
const socketioPort = window.socketio_port || __SOCKETIO_PORT__

// Module-scope resources with `auto` fetch as they are created, so App.vue's
// import graph must be pulled in after the fetcher is set.
const { default: App } = await import('@/App.vue')

const app = createApp(App)

// `socketio` puts the socket on `$socket`, which is where `getSocketInstance` looks.
app.use(FrappeUI, { socketio: { port: socketioPort } })
app.use(spritePlugin)
app.use(router)
app.mount('#app')

import '@/index.css'

import { createApp } from 'vue'
import { FrappeUI, frappeRequest, setConfig } from 'frappe-ui'
import { spritePlugin } from 'frappe-ui/icons'

setConfig('resourceFetcher', frappeRequest)

declare const __SOCKETIO_PORT__: number
declare global {
  interface Window {
    socketio_port?: number
    extend_frontend?: string[]
  }
}

// initSocket defaults to 9000 and never reads window.socketio_port, so a bench on
// any other port gets a socket that silently never connects.
const socketioPort = window.socketio_port || __SOCKETIO_PORT__

// Module-scope resources with `auto` fetch as they are created, so both import
// graphs must be pulled in after the fetcher is set.
const [{ default: App }, { default: router }] = await Promise.all([
  import('@/App.vue'),
  import('@/router'),
])

// Every source registers before the router's first resolution: the host's own
// file scripts first, then boot-listed extensions in install order.
await import('@/customizations/register')
const { loadFrontendExtensions } = await import('@framework/ui/experimental')
await loadFrontendExtensions(window.extend_frontend ?? [])

const app = createApp(App)

// `socketio` puts the socket on `$socket`, which is where `getSocketInstance` looks.
app.use(FrappeUI, { socketio: { port: socketioPort } })
app.use(spritePlugin)
app.use(router)
app.mount('#app')

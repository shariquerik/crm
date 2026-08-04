import '@/index.css'

import { createApp } from 'vue'
import { FrappeUI, frappeRequest, setConfig } from 'frappe-ui'
import { spritePlugin } from 'frappe-ui/icons'

import router from '@/router'

setConfig('resourceFetcher', frappeRequest)

// Module-scope resources with `auto` fetch as they are created, so App.vue's
// import graph must be pulled in after the fetcher is set.
const { default: App } = await import('@/App.vue')

const app = createApp(App)

// `socketio` puts the socket on `$socket`, which is where `getSocketInstance` looks.
app.use(FrappeUI, { socketio: true })
app.use(spritePlugin)
app.use(router)
app.mount('#app')

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import frappeui from 'frappe-ui/vite'
import frameworkUI from '@framework/ui/vite'

// The second CRM frontend, served at /crm2. frappe-ui resolves through
// node_modules, so its exports/imports maps drive resolution and no aliases are
// needed for it here.
export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: true,
      lucideIcons: true,
      jinjaBootData: true,
      buildConfig: {
        outDir: path.resolve(__dirname, '../crm/public/frontend2'),
        indexHtmlPath: '../crm/www/crm2.html',
        emptyOutDir: true,
        sourcemap: true,
      },
    }),
    vue(),
    vueJsx(),
    frameworkUI(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@framework/ui': path.resolve(__dirname, '../../frappe/ui/src'),
    },
  },
  // Neither is imported by this app directly, so vite's entry scan never finds
  // them and they stay unbundled CJS, which then fails ESM interop. Other frappe
  // apps get these for free because they init a socket in their own code.
  optimizeDeps: {
    include: ['feather-icons', 'socket.io-client'],
  },
  server: {
    // serve the linked @framework/ui source from the sibling app repo
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
})

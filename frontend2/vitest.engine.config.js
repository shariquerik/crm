// Runs `@framework/ui`'s own suite from here.
//
// The engine repo (`apps/frappe/ui`) ships no vitest config and cannot easily
// have one: its tests import `frappe-ui`, which is installed in *this* app's
// node_modules, not there. So the suite has always been run through an ad-hoc
// config written from memory in whichever session needed it — which is how two
// failures survived for months as "the usual two reds". This file is that
// config, committed, so a green run is the baseline rather than a judgement
// call.
//
//   yarn test:engine
//
// It is deliberately separate from `vitest.config.js`: that one runs this app's
// own tests, and the two suites need different `include`s and different dep
// handling.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import frameworkUI from '@framework/ui/vite'
import path from 'path'

const engine = path.resolve(__dirname, '../../frappe/ui/src')

export default defineConfig({
  // `frappeui()` is here for `~icons/*`: frappe-ui's own components import the
  // lucide virtual modules, so without the plugin any test that mounts a real
  // field component fails to resolve them.
  plugins: [frappeui({ lucideIcons: true }), vue(), frameworkUI()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [engine + '/**/tests/*.test.ts', engine + '/**/*.test.ts'],
    server: {
      deps: {
        // frappe-ui's sources import extensionless (`from './resources'`).
        // Vitest externalizes node_modules by default and loads them as native
        // Node ESM, which requires exact extensions, so the import fails even
        // though the file is right there. Inlining hands it to vite's resolver,
        // which does extension resolution.
        inline: ['frappe-ui'],
      },
    },
  },
  server: { fs: { allow: [path.resolve(__dirname, '../..')] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@framework/ui': engine,
    },
  },
})

// Vitest for the Studio-built CRM (`../studio/crm_studio`).
//
// It must stay inside this workspace: a config outside it cannot resolve `vitest/config`.
// Run it as `yarn test:studio` — the root has to come from the `--root` flag and the
// `--config` path has to be absolute, or the runner resolves test files against the
// filesystem root and fails to load them.

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['crm_studio/**/tests/*.test.ts'],
  },
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, '../studio/crm_studio'),
      '@framework/ui': path.resolve(__dirname, '../../frappe/ui/src'),
    },
  },
})

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

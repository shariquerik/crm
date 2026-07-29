import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import frameworkUI from '@framework/ui/vite'
import path from 'path'

export default defineConfig({
  // A module under test can reach a framework `.vue` file through an index barrel;
  // frameworkUI() is what resolves that file's own peers against this app.
  plugins: [vue(), frameworkUI()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/tests/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@framework/ui': path.resolve(__dirname, '../../frappe/ui/src'),
    },
  },
})

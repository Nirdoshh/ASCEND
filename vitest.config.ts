import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Tests run in jsdom, not in the Workers runtime.
 *
 * We keep a separate Vitest config so the Cloudflare plugin is not part of
 * the test run. Tests exercise the React UI, the domain logic and the
 * storage layer, all of which run in a normal browser environment.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
  },
})

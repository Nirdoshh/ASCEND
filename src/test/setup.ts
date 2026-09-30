import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Global test setup.
 *
 * `cleanup` unmounts any component a test forgot to unmount, so tests
 * cannot leak state into each other. Without it, a failure in one test
 * shows up as a failure in an unrelated one, which is how suites become
 * untrustworthy and get ignored.
 */
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

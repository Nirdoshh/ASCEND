import { describe, expect, it } from 'vitest'

import { ASCEND_PREFERENCES_KEY } from './keys'

describe('storage keys contract', () => {
  it('keeps theme-init.js and TypeScript in sync', () => {
    // public/theme-init.js reads localStorage using a hardcoded string.
    // If this test fails, one of them changed and the other must follow.
    expect(ASCEND_PREFERENCES_KEY).toBe('ascend:preferences:v1')
  })
})

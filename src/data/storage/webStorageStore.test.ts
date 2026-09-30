import { describe, expect, it } from 'vitest'

import { createWebStorageStore } from './webStorageStore'

describe('webStorageStore', () => {
  it('round-trips a value', () => {
    const store = createWebStorageStore()

    expect(store.write('ascend:test', { day: 12 })).toBe('ok')
    expect(store.read('ascend:test')).toEqual({ day: 12 })
  })

  it('returns null for a key that was never written', () => {
    const store = createWebStorageStore()

    expect(store.read('ascend:missing')).toBeNull()
  })

  it('discards corrupt JSON instead of throwing', () => {
    // This is the important one. A half-written value from a crashed
    // tab must not be able to break every future page load.
    window.localStorage.setItem('ascend:broken', '{not valid json')
    const store = createWebStorageStore()

    expect(store.read('ascend:broken')).toBeNull()
    // The bad value is removed so the next load is clean.
    expect(window.localStorage.getItem('ascend:broken')).toBeNull()
  })

  it('removes a key', () => {
    const store = createWebStorageStore()
    store.write('ascend:test', 1)

    store.remove('ascend:test')

    expect(store.read('ascend:test')).toBeNull()
  })

  it('reports unavailable when storage cannot be used at all', () => {
    // Simulates private browsing / blocked storage: constructing the
    // store with null must degrade quietly, never crash the app.
    const store = createWebStorageStore(null)

    expect(store.isAvailable()).toBe(false)
    expect(store.read('ascend:test')).toBeNull()
    expect(store.write('ascend:test', { a: 1 })).toBe('unavailable')
    expect(() => store.remove('ascend:test')).not.toThrow()
  })

  it('reports quota-exceeded distinctly from unavailable', () => {
    // The UI shows a different message for "too much data" than for
    // "storage is blocked", so the two cases must not collapse.
    const quotaError = new DOMException('full', 'QuotaExceededError')
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw quotaError
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as unknown as Storage

    const store = createWebStorageStore(failing)

    expect(store.write('ascend:test', { a: 1 })).toBe('quota-exceeded')
  })
})

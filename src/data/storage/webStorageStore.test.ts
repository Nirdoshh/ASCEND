import { describe, expect, it, vi } from 'vitest'

import { createWebStorageStore } from './webStorageStore'

describe('webStorageStore', () => {
  it('reads explicitly without destroying invalid JSON', () => {
    window.localStorage.setItem('ascend:preserved', '{broken')
    const store = createWebStorageStore()
    expect(store.readResult('ascend:missing')).toEqual({ ok: true, value: null })
    expect(store.readResult('ascend:preserved')).toEqual({ ok: false, problem: 'invalid-data' })
    expect(window.localStorage.getItem('ascend:preserved')).toBe('{broken')
    store.write('ascend:valid', { kept: true })
    expect(store.readResult('ascend:valid')).toEqual({ ok: true, value: { kept: true } })
  })

  it('only enumerates matching keys without reading unrelated values', () => {
    window.localStorage.setItem('ascend:history:one', '{}')
    window.localStorage.setItem('unrelated:key', '{broken')
    const store = createWebStorageStore()
    const read = vi.spyOn(Storage.prototype, 'getItem')
    expect(store.keysWithPrefix('ascend:history:')).toEqual({ ok: true, value: ['ascend:history:one'] })
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
  })

  it('reports storage that becomes unavailable during a read or enumeration', () => {
    const store = createWebStorageStore()
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(store.readResult('ascend:history')).toEqual({ ok: false, problem: 'storage-unavailable' })
    read.mockRestore()
    const keys = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('blocked') })
    window.localStorage.setItem('ascend:history', '{}')
    expect(store.keysWithPrefix('ascend:')).toEqual({ ok: false, problem: 'storage-unavailable' })
    keys.mockRestore()
  })

  it('reports explicit reads and enumeration unavailable when storage is absent', () => {
    const store = createWebStorageStore(null)
    expect(store.readResult('ascend:history')).toEqual({ ok: false, problem: 'storage-unavailable' })
    expect(store.keysWithPrefix('ascend:')).toEqual({ ok: false, problem: 'storage-unavailable' })
  })

  it('round-trips a value', () => {
    const store = createWebStorageStore()

    expect(store.write('ascend:test', { day: 12 })).toBe('ok')
    expect(store.read('ascend:test')).toEqual({ day: 12 })
  })

  it('returns null for a key that was never written', () => {
    const store = createWebStorageStore()

    expect(store.read('ascend:missing')).toBeNull()
  })

  it('preserves corrupt JSON while returning null instead of throwing', () => {
    // This is the important one. A half-written value from a crashed
    // tab must not be able to break every future page load.
    window.localStorage.setItem('ascend:broken', '{not valid json')
    const store = createWebStorageStore()

    expect(store.read('ascend:broken')).toBeNull()
    // Keep the original bytes for recovery, including reads by route guards.
    expect(window.localStorage.getItem('ascend:broken')).toBe('{not valid json')
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

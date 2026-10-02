import { beforeEach, describe, expect, it } from 'vitest'

import { createSuggestedSystemData } from '../../domain/systemPathGoal'
import { ASCEND_SYSTEM_KEY } from '../storage/keys'
import { createWebStorageStore, type KeyValueStore } from '../storage/webStorageStore'
import { createSystemRepository } from './systemRepository'

const NOW = '2026-10-02T12:00:00.000Z'

beforeEach(() => window.localStorage.clear())

describe('System repository', () => {
  it('persists records and protects future or malformed data', () => {
    const repository = createSystemRepository(createWebStorageStore())
    const data = createSuggestedSystemData(NOW)
    expect(repository.save(data)).toBe('ok')
    expect(repository.read()).toEqual({ ok: true, value: data })
    const future = JSON.stringify({ schemaVersion: 99, paths: [], goals: [] })
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, future)
    expect(repository.read()).toEqual({ ok: false, problem: 'newer-schema' })
    expect(repository.save(data)).toBe('newer-schema')
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(future)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, '{broken')
    expect(repository.read()).toEqual({ ok: false, problem: 'invalid-data' })
    expect(repository.save(data)).toBe('invalid-data')
  })

  it('reports storage failures without throwing', () => {
    const unavailable: KeyValueStore = {
      isAvailable: () => false,
      readResult: () => ({ ok: false, problem: 'storage-unavailable' }),
      keysWithPrefix: () => ({ ok: false, problem: 'storage-unavailable' }),
      read: () => null,
      write: () => 'unavailable',
      remove: () => undefined,
    }
    const repository = createSystemRepository(unavailable)
    expect(repository.read()).toEqual({ ok: false, problem: 'storage-unavailable' })
    expect(repository.save(createSuggestedSystemData(NOW))).toBe('unavailable')
  })
})

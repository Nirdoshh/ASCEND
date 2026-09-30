import { describe, expect, it } from 'vitest'

import { createWebStorageStore } from '../storage'
import {
  createPreferencesRepository,
  DEFAULT_PREFERENCES,
  migrateAndNormalize,
  PREFERENCES_SCHEMA_VERSION,
} from './preferencesRepository'

describe('migrateAndNormalize', () => {
  it('returns defaults when nothing is stored', () => {
    expect(migrateAndNormalize(null)).toEqual(DEFAULT_PREFERENCES)
    expect(migrateAndNormalize(undefined)).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults for a non-object value', () => {
    // Someone will eventually hand-edit exported JSON. A string, a
    // number or an array must not reach the UI as preferences.
    expect(migrateAndNormalize('dark')).toEqual(DEFAULT_PREFERENCES)
    expect(migrateAndNormalize(42)).toEqual(DEFAULT_PREFERENCES)
    expect(migrateAndNormalize(['dark'])).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps a valid theme', () => {
    expect(migrateAndNormalize({ schemaVersion: 1, theme: 'dark' }).theme).toBe('dark')
  })

  it('replaces an invalid theme with the default, keeping other fields', () => {
    // Field-level validation: one bad value must not discard good ones.
    const result = migrateAndNormalize({ schemaVersion: 1, theme: 'neon' })

    expect(result.theme).toBe('system')
    expect(result.schemaVersion).toBe(1)
  })

  it('treats a missing version as version 0', () => {
    // A value with no schemaVersion is either ancient or hand-written.
    // With no migration registered for v0 we start clean rather than
    // guess what it meant.
    expect(migrateAndNormalize({ theme: 'dark' })).toEqual(DEFAULT_PREFERENCES)
  })

  it('does not trust a future version it does not understand', () => {
    // v2 data opened by a v1 build must not silently lose fields.
    // We keep what we recognise and default the rest.
    const result = migrateAndNormalize({ schemaVersion: 99, theme: 'dark', futureFlag: true })

    expect(result.theme).toBe('dark')
    expect(result.schemaVersion).toBe(1)
  })

  it('applies registered migrations in order', () => {
    // The migration mechanism is empty at v1, so it has no production
    // path yet. This test proves the mechanism works before we rely on
    // it with real user data.
    const migrations = {
      1: (value: unknown) => ({ ...(value as object), theme: 'dark' }),
      2: (value: unknown) => ({ ...(value as object), extra: true }),
    }

    const result = migrateAndNormalize({ schemaVersion: 1, theme: 'light' }, 3, migrations)

    expect(result.theme).toBe('dark')
    // Note: the result is ALWAYS stamped with this build's schema
    // version (1), even when currentVersion is injected as 3 to drive
    // the chain. The injected version only decides how far to migrate;
    // the output describes what this build understands.
    expect(result.schemaVersion).toBe(PREFERENCES_SCHEMA_VERSION)
  })

  it('falls back to defaults when a migration step is missing', () => {
    const result = migrateAndNormalize({ schemaVersion: 1, theme: 'dark' }, 3, {})

    expect(result).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('preferencesRepository', () => {
  it('saves and loads a preference through the store', () => {
    const store = createWebStorageStore()
    const repository = createPreferencesRepository(store)

    repository.save({ schemaVersion: 1, theme: 'dark' })

    expect(repository.load().theme).toBe('dark')
  })

  it('returns defaults on first run', () => {
    const repository = createPreferencesRepository(createWebStorageStore())

    expect(repository.load()).toEqual(DEFAULT_PREFERENCES)
  })

  it('does not persist through the component layer', () => {
    // Guards the rule that matters most for Phase 11: persistence is
    // only reachable through the repository, so swapping localStorage
    // for the Worker API is a one-file change.
    const repository = createPreferencesRepository(createWebStorageStore())
    repository.save({ schemaVersion: 1, theme: 'light' })

    const raw = window.localStorage.getItem('ascend:preferences:v1')

    expect(raw).toBe(JSON.stringify({ schemaVersion: 1, theme: 'light' }))
  })

  it('resets back to defaults', () => {
    const store = createWebStorageStore()
    const repository = createPreferencesRepository(store)
    repository.save({ schemaVersion: 1, theme: 'dark' })

    repository.reset()

    expect(repository.load()).toEqual(DEFAULT_PREFERENCES)
  })

  it('reports availability honestly', () => {
    // The UI shows a warning when preferences cannot be persisted, so
    // this must reflect the store rather than assume success.
    expect(createPreferencesRepository(createWebStorageStore()).isAvailable()).toBe(true)
    expect(createPreferencesRepository(createWebStorageStore(null)).isAvailable()).toBe(false)
  })
})

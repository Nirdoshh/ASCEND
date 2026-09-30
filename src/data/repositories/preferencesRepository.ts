/**
 * Preferences repository.
 *
 * Phase 1 scope note:
 *   Modification 4 of the approved plan said not to build a generic
 *   settings key/value system until there is a real need. So there is
 *   exactly ONE preference object with a named, typed field, stored
 *   under one versioned key. We get migration safety without inventing a
 *   settings table we do not yet need.
 *
 *   When we later need "reduce motion", "notification time" or similar,
 *   they become fields on THIS object, which is why the version lives
 *   here at all.
 */

import { ASCEND_PREFERENCES_KEY } from '../storage/keys'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Preferences {
  schemaVersion: typeof PREFERENCES_SCHEMA_VERSION
  theme: ThemePreference
}

/**
 * Bump this when the shape changes, and add a migration below.
 * Stored inside the value as well as in the storage key, so a future
 * export can be interpreted without guessing.
 */
export const PREFERENCES_SCHEMA_VERSION = 1

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
  theme: 'system',
}

export interface PreferencesRepository {
  load(): Preferences
  save(preferences: Preferences): StoreWriteResult
  reset(): void
  /**
   * Whether preferences can actually be persisted right now.
   *
   * The UI needs this to be honest with the user. Without it we would
   * have to guess, and guessing here means telling someone their
   * setting was saved when it was not.
   */
  isAvailable(): boolean
}

const THEME_VALUES: readonly string[] = ['system', 'light', 'dark']

/**
 * Migrations from older schema versions to newer ones.
 *
 * Empty at v1, because there is no v0. The mechanism exists now so that
 * when v2 arrives we never have to retrofit it onto live user data.
 *
 *   { 1: (value) => ({ ...value, reduceMotion: 'system' }) }
 *
 * Each entry upgrades FROM that version TO version + 1.
 */
export const PREFERENCES_MIGRATIONS: Record<number, (value: unknown) => unknown> = {}

export function createPreferencesRepository(store: KeyValueStore): PreferencesRepository {
  return {
    load(): Preferences {
      const raw = store.read(ASCEND_PREFERENCES_KEY)
      return migrateAndNormalize(raw)
    },

    save(preferences: Preferences): StoreWriteResult {
      return store.write(ASCEND_PREFERENCES_KEY, preferences)
    },

    reset(): void {
      store.remove(ASCEND_PREFERENCES_KEY)
    },

    isAvailable: () => store.isAvailable(),
  }
}

/**
 * Turns anything at all into valid Preferences.
 *
 * Exported and pure so it can be tested directly. Three things can
 * arrive here:
 *   - null            (never saved, or storage unavailable)
 *   - an older version (migration path)
 *   - a current object (normal load)
 * and one thing that must never arrive:
 *   - something corrupt or hand-edited (we fall back to defaults)
 */
export function migrateAndNormalize(
  raw: unknown,
  currentVersion: number = PREFERENCES_SCHEMA_VERSION,
  migrations: Record<number, (value: unknown) => unknown> = PREFERENCES_MIGRATIONS,
): Preferences {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_PREFERENCES }
  }

  let value: object = raw

  const startVersion = readSchemaVersion(value)

  // An unknown FUTURE version means this build is older than the data.
  // Trusting it could silently drop fields the user expects to exist,
  // so we keep what we understand and default the rest.
  if (startVersion > currentVersion) {
    return normalizeFields(value)
  }

  for (let version = startVersion; version < currentVersion; version += 1) {
    const migrate = migrations[version]
    if (!migrate) {
      // No migration for this step: we cannot reconstruct the data, so
      // we start clean rather than serve a half-understood object.
      return { ...DEFAULT_PREFERENCES }
    }
    value = migrate(value) as object
  }

  return normalizeFields(value)
}

function readSchemaVersion(value: object): number {
  const candidate = (value as { schemaVersion?: unknown }).schemaVersion
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0
}

/**
 * Field-by-field validation.
 *
 * Every field is checked independently, so one bad value cannot discard
 * good values. This is the main defence against corrupt or tampered
 * storage: the UI can assume every field of Preferences is valid.
 */
function normalizeFields(value: object): Preferences {
  const candidate = value as Partial<Record<keyof Preferences, unknown>>

  const theme =
    typeof candidate.theme === 'string' && THEME_VALUES.includes(candidate.theme)
      ? (candidate.theme as ThemePreference)
      : DEFAULT_PREFERENCES.theme

  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    theme,
  }
}

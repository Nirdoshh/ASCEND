/**
 * Journey repository.
 *
 * Follows the same shape as onboardingDraftRepository: read raw, migrate,
 * validate field by field, never throw. Version guards from ADR 0011
 * apply from day one — a build that sees a newer schema refuses rather
 * than silently damaging it.
 */

import { normalizeJourney, hasNewerJourneySchema, type Journey } from '../../domain/journey'
import { ASCEND_JOURNEY_KEY } from '../storage/keys'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'
import type { RepositoryReadResult } from './readResult'

export type JourneyRepositoryWriteResult = StoreWriteResult | 'newer-schema' | 'already-exists'

export interface JourneyRepository {
  /** Explicit read for consumers that must distinguish absence from failure. */
  readActive(): RepositoryReadResult<Journey | null>
  /** The active Journey, or null when there is none. */
  loadActive(): Journey | null
  /**
   * Writes the Journey, unless storage holds one from a newer build
   * or an active Journey already exists (V1 = one active Journey).
   */
  save(journey: Journey): JourneyRepositoryWriteResult
  /** Called when the user explicitly deletes their Journey (future phase). */
  clear(): void
  isAvailable(): boolean
}

export function createJourneyRepository(store: KeyValueStore): JourneyRepository {
  return {
    readActive() {
      const raw = store.readResult(ASCEND_JOURNEY_KEY)
      if (!raw.ok) return raw
      if (raw.value === null) return { ok: true, value: null }
      if (hasNewerJourneySchema(raw.value)) return { ok: false, problem: 'newer-schema' }
      const journey = normalizeJourney(raw.value, nowIso())
      // Progress must not invent the Journey start date from a fallback clock.
      const startedAt = (raw.value as Record<string, unknown>).startedAt
      if (!journey || typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) {
        return { ok: false, problem: 'invalid-data' }
      }
      return { ok: true, value: journey }
    },

    loadActive(): Journey | null {
      const raw = store.read(ASCEND_JOURNEY_KEY)
      if (!raw) return null

      if (hasNewerJourneySchema(raw)) {
        return null
      }

      return normalizeJourney(raw, nowIso())
    },

    save(journey: Journey): JourneyRepositoryWriteResult {
      const currentRaw = store.read(ASCEND_JOURNEY_KEY)
      if (hasNewerJourneySchema(currentRaw)) {
        return 'newer-schema'
      }

      if (currentRaw !== null) {
        const existing = normalizeJourney(currentRaw, nowIso())
        if (existing && existing.status === 'active') {
          return 'already-exists'
        }
      }

      return store.write(ASCEND_JOURNEY_KEY, journey)
    },

    clear(): void {
      store.remove(ASCEND_JOURNEY_KEY)
    },

    isAvailable: () => store.isAvailable(),
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

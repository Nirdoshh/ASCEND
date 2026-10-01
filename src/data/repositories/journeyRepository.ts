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

export type JourneyRepositoryWriteResult = StoreWriteResult | 'newer-schema' | 'already-exists'

export interface JourneyRepository {
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
/**
 * Daily Plan repository.
 *
 * Follows the same shape as journeyRepository: read raw, validate,
 * never throw. Version guards from ADR 0011 apply from day one — a
 * build that sees a newer schema refuses rather than silently damaging it.
 *
 * CONCURRENCY NOTE (V1):
 *
 * localStorage does NOT provide cross-tab atomicity. The `getOrCreate`
 * below uses a check-then-write pattern which can race if two tabs
 * call it simultaneously for the same (journeyId, localDate).
 *
 * In practice for V1 (single-user, low contention):
 * - the race window is tiny (microseconds)
 * - if a race occurs, one tab writes, the other overwrites with an
 *   identical plan (same journeyId, localDate, schemaVersion)
 * - the net result is still exactly one plan record
 *
 * D1 (Phase 11) will enforce UNIQUE(journey_id, local_date) at the
 * database level for true cross-tab safety.
 *
 * This implementation returns the CURRENTLY persisted plan after a
 * successful write (read-after-write) so the caller sees what actually
 * landed in storage, even if a race occurred.
 */

import { normalizeDailyPlan, hasNewerDailyPlanSchema, type DailyPlan } from '../../domain/dailyPlan'
import { dailyPlanStorageKey } from '../../domain/dailyPlan'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'
import { isValidLocalDate } from '../../domain/localDate'
import type { RepositoryReadResult } from './readResult'

export type DailyPlanRepositoryWriteResult = StoreWriteResult | 'newer-schema'

export interface DailyPlanRepository {
  /** Read-only history, ordered by saved local date. Never rewrites data. */
  listForJourney(journeyId: string): RepositoryReadResult<DailyPlan[]>
  /** Loads the plan for a specific journey and date, or null if none exists. */
  loadForDate(journeyId: string, localDate: string): DailyPlan | null
  /**
   * Creates a new plan, or returns the existing one if already present.
   *
   * Returns the CURRENTLY persisted plan via read-after-write so the
   * caller sees what actually landed in storage. If a cross-tab race
   * occurred, the winner's plan is returned.
   */
  getOrCreate(journeyId: string, localDate: string, plan: DailyPlan): Promise<{ result: DailyPlanRepositoryWriteResult; plan: DailyPlan | null }>
  /** Checks if a plan exists for the given journey and date. */
  existsForDate(journeyId: string, localDate: string): boolean
  isAvailable(): boolean
}

export function createDailyPlanRepository(store: KeyValueStore): DailyPlanRepository {
  return {
    listForJourney(journeyId) {
      const prefix = dailyPlanStorageKey(journeyId, '')
      const keys = store.keysWithPrefix(prefix)
      if (!keys.ok) return keys
      const plans: DailyPlan[] = []
      const ids = new Set<string>()
      for (const key of keys.value) {
        const raw = store.readResult(key)
        if (!raw.ok) return raw
        if (raw.value === null) continue // Removed between enumeration and read.
        if (hasNewerDailyPlanSchema(raw.value)) return { ok: false, problem: 'newer-schema' }
        const plan = normalizeDailyPlan(raw.value, nowIso())
        if (!plan || plan.journeyId !== journeyId || !isValidLocalDate(plan.localDate)
          || dailyPlanStorageKey(journeyId, plan.localDate) !== key || ids.has(plan.id)) {
          return { ok: false, problem: 'invalid-data' }
        }
        ids.add(plan.id)
        plans.push(plan)
      }
      plans.sort((a, b) => a.localDate.localeCompare(b.localDate))
      return { ok: true, value: plans }
    },

    loadForDate(journeyId: string, localDate: string): DailyPlan | null {
      const key = dailyPlanStorageKey(journeyId, localDate)
      const raw = store.read(key)
      if (!raw) return null

      if (hasNewerDailyPlanSchema(raw)) {
        return null
      }

      return normalizeDailyPlan(raw, nowIso())
    },

    async getOrCreate(journeyId: string, localDate: string, plan: DailyPlan): Promise<{ result: DailyPlanRepositoryWriteResult; plan: DailyPlan | null }> {
      const key = dailyPlanStorageKey(journeyId, localDate)

      // Check if a plan already exists for this journey/date
      const existingRaw = store.read(key)
      if (existingRaw) {
        if (hasNewerDailyPlanSchema(existingRaw)) {
          return { result: 'newer-schema', plan: null }
        }
        // Existing plan found — return it (the plan passed in is ignored)
        const existing = normalizeDailyPlan(existingRaw, nowIso())
        if (existing) {
          return { result: 'ok', plan: existing }
        }
      }

      // No existing plan — write the new one
      const writeResult = store.write(key, plan)

      // Read-after-write: return what actually persisted
      // If a cross-tab race occurred, this returns the winner's plan
      const persistedRaw = store.read(key)
      let persistedPlan: DailyPlan | null = null
      if (persistedRaw && !hasNewerDailyPlanSchema(persistedRaw)) {
        persistedPlan = normalizeDailyPlan(persistedRaw, nowIso())
      }

      return { result: writeResult, plan: persistedPlan }
    },

    existsForDate(journeyId: string, localDate: string): boolean {
      const key = dailyPlanStorageKey(journeyId, localDate)
      const raw = store.read(key)
      if (!raw) return false
      if (hasNewerDailyPlanSchema(raw)) return false
      return normalizeDailyPlan(raw, nowIso()) !== null
    },

    isAvailable: () => store.isAvailable(),
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

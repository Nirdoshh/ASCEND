/**
 * Daily Steps repository.
 *
 * Follows the same shape as todayWinRepository: read raw, validate,
 * never throw. Version guards from ADR 0011 apply from day one — a
 * build that sees a newer schema refuses rather than silently damaging it.
 */

import { normalizeDailySteps, hasNewerDailyStepsSchema, type DailyStep } from '../../domain/dailyStep'
import { dailyStepsStorageKey } from '../../domain/dailyStep'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'

export type DailyStepsRepositoryWriteResult = StoreWriteResult | 'newer-schema'

export interface DailyStepsRepository {
  /** Loads the steps for a specific daily plan, or empty array if none exist. */
  loadForPlan(dailyPlanId: string): DailyStep[]
  /** Saves the entire steps list for a daily plan. */
  save(dailyPlanId: string, steps: DailyStep[]): StoreWriteResult | 'newer-schema'
  /** Checks if steps exist for the given daily plan. */
  existsForPlan(dailyPlanId: string): boolean
  isAvailable(): boolean
}

export function createDailyStepsRepository(store: KeyValueStore) {
  return {
    loadForPlan(dailyPlanId: string): DailyStep[] {
      const key = dailyStepsStorageKey(dailyPlanId)
      const raw = store.read(key)
      if (!raw) return []

      if (hasNewerDailyStepsSchema(raw)) {
        return []
      }

      return normalizeDailySteps(raw) ?? []
    },

    save(dailyPlanId: string, steps: DailyStep[]): StoreWriteResult | 'newer-schema' {
      const key = dailyStepsStorageKey(dailyPlanId)

      // Check if existing data has a newer schema
      const existingRaw = store.read(key)
      if (existingRaw && hasNewerDailyStepsSchema(existingRaw)) {
        return 'newer-schema'
      }

      // Write the steps
      return store.write(key, steps)
    },

    existsForPlan(dailyPlanId: string): boolean {
      const key = dailyStepsStorageKey(dailyPlanId)
      const raw = store.read(key)
      if (!raw) return false
      if (hasNewerDailyStepsSchema(raw)) return false
      const steps = normalizeDailySteps(raw)
      return steps !== null && steps.length > 0
    },

    isAvailable: () => store.isAvailable(),
  }
}

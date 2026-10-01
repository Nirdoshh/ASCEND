/**
 * Today's Win repository.
 *
 * Follows the same shape as dailyPlanRepository: read raw, validate,
 * never throw. Version guards from ADR 0011 apply from day one — a
 * build that sees a newer schema refuses rather than silently damaging it.
 */

import { normalizeTodayWin, hasNewerTodayWinSchema, type TodayWin } from '../../domain/todayWin'
import { todayWinStorageKey } from '../../domain/todayWin'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'

export type TodayWinRepositoryWriteResult = StoreWriteResult | 'newer-schema'

export interface TodayWinRepository {
  /** Loads the win for a specific daily plan, or null if none exists. */
  loadForPlan(dailyPlanId: string): TodayWin | null
  /** Creates a new win, or returns the existing one if already present. */
  save(win: TodayWin): TodayWinRepositoryWriteResult
  /** Checks if a win exists for the given daily plan. */
  existsForPlan(dailyPlanId: string): boolean
  isAvailable(): boolean
}

export function createTodayWinRepository(store: KeyValueStore): TodayWinRepository {
  return {
    loadForPlan(dailyPlanId: string): TodayWin | null {
      const key = todayWinStorageKey(dailyPlanId)
      const raw = store.read(key)
      if (!raw) return null

      if (hasNewerTodayWinSchema(raw)) {
        return null
      }

      return normalizeTodayWin(raw, nowIso())
    },

    save(win: TodayWin): TodayWinRepositoryWriteResult {
      const key = todayWinStorageKey(win.dailyPlanId)

      // Check if a win already exists for this daily plan
      const existingRaw = store.read(key)
      if (existingRaw) {
        if (hasNewerTodayWinSchema(existingRaw)) {
          return 'newer-schema'
        }
        // Existing win found — cannot create a second one
        // Return the existing one instead of overwriting
        const existing = normalizeTodayWin(existingRaw, nowIso())
        if (existing && existing.id !== win.id) {
          return 'ok'
        }
      }

      // No existing win — write the new one
      return store.write(todayWinStorageKey(win.dailyPlanId), win)
    },

    existsForPlan(dailyPlanId: string): boolean {
      const key = todayWinStorageKey(dailyPlanId)
      const raw = store.read(key)
      if (!raw) return false
      if (hasNewerTodayWinSchema(raw)) return false
      return normalizeTodayWin(raw, nowIso()) !== null
    },

    isAvailable: () => store.isAvailable(),
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

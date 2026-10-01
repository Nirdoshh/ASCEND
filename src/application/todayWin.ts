/**
 * Today's Win application service.
 *
 * This is the single operation that creates or updates today's Win
 * for the active DailyPlan. It owns the rules:
 *
 *   1. Verify DailyPlan exists
 *   2. Validate text
 *   3. If Win exists, update it (preserving id)
 *   4. If no Win exists, create exactly one
 *   5. Persist safely
 *
 * React must not contain these rules. A component that re-implements them
 * is a second implementation that will drift.
 */

import type { TodayWinRepository } from '../data/repositories/todayWinRepository'
import type { DailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import type { JourneyRepository } from '../data/repositories/journeyRepository'
import type { DailyPlan } from '../domain/dailyPlan'
import type { TodayWin } from '../domain/todayWin'
import { createTodayWin, createTodayWinId, updateTodayWin, validateTodayWinText } from '../domain/todayWin'
import { createSystemLocalDateProvider } from '../domain/localDate'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { LocalDate } from '../domain/localDate'

export type TodayWinResult =
  | { readonly ok: true; readonly win: TodayWin; readonly isNew: boolean }
  | { readonly ok: false; readonly problem: TodayWinProblem; readonly message: string }

export type TodayWinProblem =
  | 'no-daily-plan'
  | 'no-journey'
  | 'invalid-text'
  | 'win-exists'
  | 'newer-win-schema'
  | 'storage-unavailable'
  | 'unknown'

/**
 * Sets or updates today's Win for the active DailyPlan.
 *
 * @param journeyRepository - Repository to load the active Journey
 * @param planRepository - Repository to load/create the DailyPlan
 * @param winRepository - Repository to load/save the TodayWin
 * @param text - The Win text (trimmed, validated)
 * @param now - Current timestamp (injected for testing, defaults to now)
 * @returns The existing or newly created/updated TodayWin, or a failure
 */
export async function setTodayWin(
  journeyRepository: JourneyRepository,
  planRepository: DailyPlanRepository,
  winRepository: TodayWinRepository,
  text: string,
  now: string = new Date().toISOString(),
): Promise<TodayWinResult> {
  // 1. Validate text
  const validation = validateTodayWinText(text)
  if (!validation.ok) {
    return { ok: false, problem: 'invalid-text', message: validation.message }
  }

  // 2. Get active Journey
  const journey = journeyRepository.loadActive()
  if (!journey) {
    return { ok: false, problem: 'no-journey', message: 'No active Journey exists.' }
  }

  // 3. Get today's DailyPlan for this journey
  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) {
    return { ok: false, problem: 'no-daily-plan', message: 'No active DailyPlan exists.' }
  }

  // 4. Check for existing Win
  const existingWin = winRepository.loadForPlan(todayPlan.id)
  if (existingWin) {
    // Update existing Win
    const updatedWin = updateTodayWin(existingWin, text.trim(), now)
    const saveResult = winRepository.save(updatedWin)

    if (saveResult === 'newer-schema') {
      // Race condition - load and return the winner
      const winner = winRepository.loadForPlan(todayPlan.id)
      if (winner) {
        return { ok: true, win: winner, isNew: false }
      }
      return { ok: false, problem: 'newer-win-schema', message: 'A newer win exists.' }
    }

    if (saveResult !== 'ok') {
      return { ok: false, problem: 'storage-unavailable', message: 'Could not save Today\'s Win.' }
    }

    return { ok: true, win: updatedWin, isNew: false }
  }

  // 4. No Win exists — create exactly one
  const winId = createTodayWinId()
  const newWin = createTodayWin(todayPlan.id, text.trim(), now, winId)

  // 5. Persist the Win
  const saveResult = winRepository.save(newWin)

  if (saveResult === 'newer-schema') {
    const winner = winRepository.loadForPlan(todayPlan.id)
    if (winner) {
      return { ok: true, win: winner, isNew: false }
    }
    return { ok: false, problem: 'newer-win-schema', message: 'A newer win exists.' }
  }

  if (saveResult !== 'ok') {
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save Today\'s Win.' }
  }

  // 6. Return the newly created Win
  return { ok: true, win: newWin, isNew: true }
}

/**
 * Loads today's Win if it exists, without creating one.
 */
export function loadTodayWin(
  planRepository: DailyPlanRepository,
  winRepository: TodayWinRepository,
  journeyRepository: JourneyRepository,
): TodayWin | null {
  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const journey = journeyRepository.loadActive()
  if (!journey) return null

  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) return null

  return winRepository.loadForPlan(todayPlan.id)
}

/**
 * Checks whether today's Win can be created/loaded right now (without doing it).
 */
export function canLoadTodayWin(
  planRepository: DailyPlanRepository,
  winRepository: TodayWinRepository,
  journeyRepository: JourneyRepository,
): { readonly can: boolean; readonly reason?: string } {
  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const journey = journeyRepository.loadActive()
  if (!journey) return { can: false, reason: 'no-journey' }

  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) return { can: false, reason: 'no-daily-plan' }

  if (!winRepository.isAvailable()) return { can: false, reason: 'storage-unavailable' }

  return { can: true }
}

/**
 * Gets today's DailyPlan without creating a Win.
 * Useful for read-only access or diagnostics.
 */
export function loadTodayPlan(
  planRepository: DailyPlanRepository,
  journeyRepository: JourneyRepository,
): DailyPlan | null {
  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const journey = journeyRepository.loadActive()
  if (!journey) return null

  return planRepository.loadForDate(journey.id, localDate)
}
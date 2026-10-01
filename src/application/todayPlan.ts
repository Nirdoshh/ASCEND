/**
 * Today Plan application service.
 *
 * This is the single operation that gets or creates today's DailyPlan
 * for the active Journey. It owns the rules:
 *
 *   1. Load the active Journey
 *   2. Determine the user's local date
 *   3. Look for existing DailyPlan for (journeyId, localDate)
 *   4. Return it if present
 *   5. Otherwise create exactly one plan
 *   6. Persist it safely
 *   7. Return the plan
 *
 * If no active Journey exists:
 *   returns an appropriate failure rather than creating orphan data.
 *
 * React must not contain these rules. A component that re-implements them
 * is a second implementation that will drift.
 */

import type { JourneyRepository } from '../data/repositories/journeyRepository'
import type { DailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import type { DailyPlan, LocalDate } from '../domain/dailyPlan'
import { createDailyPlan, createDailyPlanId } from '../domain/dailyPlan'
import { createSystemLocalDateProvider } from '../domain/localDate'

export type TodayPlanResult =
  | { readonly ok: true; readonly plan: DailyPlan; readonly isNew: boolean }
  | { readonly ok: false; readonly problem: TodayPlanProblem; readonly message: string }

export type TodayPlanProblem =
  | 'no-journey'
  | 'newer-plan-schema'
  | 'storage-unavailable'
  | 'unknown'

/**
 * Gets or creates today's DailyPlan for the active Journey.
 *
 * @param journeyRepository - Repository to load the active Journey
 * @param planRepository - Repository to load/create the DailyPlan
 * @param localDateProvider - Provider for the current local date (injectable for testing)
 * @param now - Current timestamp (injected for testing, defaults to now)
 * @returns The existing or newly created DailyPlan, or a failure
 */
export async function getOrCreateTodayPlan(
  journeyRepository: JourneyRepository,
  planRepository: DailyPlanRepository,
  localDateProvider: { today(): LocalDate } = createSystemLocalDateProvider(),
  now: string = new Date().toISOString(),
): Promise<TodayPlanResult> {
  // 1. Load the active Journey
  const journey = journeyRepository.loadActive()
  if (!journey) {
    return { ok: false, problem: 'no-journey', message: 'No active Journey exists.' }
  }

  // 2. Determine the user's local date
  const localDate = localDateProvider.today()

  // 3. Look for existing DailyPlan for (journeyId, localDate)
  const existingPlan = planRepository.loadForDate(journey.id, localDate)
  if (existingPlan) {
    return { ok: true, plan: existingPlan, isNew: false }
  }

  // 4. No plan exists — create exactly one
  const planId = createDailyPlanId()
  const newPlan = createDailyPlan(journey.id, localDate, now, planId)

  // 5. Persist the plan (getOrCreate handles the race condition)
  const { result: saveResult, plan: persistedPlan } = await planRepository.getOrCreate(journey.id, localDate, newPlan)

  if (saveResult === 'newer-schema') {
    // A newer plan exists (race condition with another tab)
    // Load and return the winning plan
    const winner = planRepository.loadForDate(journey.id, localDate)
    if (winner) {
      return { ok: true, plan: winner, isNew: false }
    }
    return { ok: false, problem: 'newer-plan-schema', message: 'A newer plan exists.' }
  }

  if (saveResult !== 'ok') {
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save today\'s plan.' }
  }

  // 6. Return the plan that actually persisted (read-after-write)
  const planToReturn = persistedPlan ?? newPlan
  return { ok: true, plan: planToReturn, isNew: true }
}

/**
 * Checks whether today's plan can be created/loaded right now (without doing it).
 *
 * Useful for diagnostics or showing/hiding UI elements.
 */
export function canLoadTodayPlan(
  journeyRepository: JourneyRepository,
  planRepository: DailyPlanRepository,
): { readonly can: boolean; readonly reason?: string } {
  const journey = journeyRepository.loadActive()
  if (!journey) return { can: false, reason: 'no-journey' }

  // Plan repository availability is the only other concern
  if (!planRepository.isAvailable()) return { can: false, reason: 'storage-unavailable' }

  return { can: true }
}

/**
 * Returns today's plan if it exists, without creating one.
 *
 * Useful for read-only access or diagnostics.
 */
export function loadTodayPlan(
  journeyRepository: JourneyRepository,
  planRepository: DailyPlanRepository,
  localDateProvider: { today(): LocalDate } = createSystemLocalDateProvider(),
): DailyPlan | null {
  const journey = journeyRepository.loadActive()
  if (!journey) return null

  const localDate = localDateProvider.today()
  return planRepository.loadForDate(journey.id, localDate)
}
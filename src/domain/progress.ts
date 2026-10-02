import type { DailyPlan } from './dailyPlan'
import { isDailyStepCompleted, validateDailyStepCount, type DailyStep } from './dailyStep'
import type { Journey } from './journey'
import { addLocalDays, localDaysBetween, type LocalDate } from './localDate'

export interface ProgressDay {
  readonly localDate: LocalDate
  readonly hasPlan: boolean
  readonly isBeforeJourney: boolean
  readonly totalSteps: number
  readonly completedSteps: number
  readonly isActive: boolean
  readonly isFullyComplete: boolean
}

export interface ProgressSnapshot {
  readonly journeyId: string
  readonly asOfLocalDate: LocalDate
  readonly planDays: number
  readonly totalActions: number
  readonly completedActions: number
  readonly activeDays: number
  readonly fullyCompletedDays: number
  readonly recentDays: readonly ProgressDay[]
  readonly recentActiveDays: number
  /** Inclusive calendar day: the start date is Day 1; future starts are Day 0. */
  readonly journeyElapsedDays: number
  readonly journeyDurationDays: number
}

export interface ProgressSourceDay {
  readonly plan: DailyPlan
  readonly steps: DailyStep[]
}

/**
 * Derives observable activity from the current source records, as of a local date.
 * Completion belongs to the plan date, not the completion timestamp's UTC date.
 * A fully complete day has a valid 2–4-step composition, all complete.
 * Every preserved step counts, including over-full sets. Deleted steps no longer
 * exist in source history; this snapshot is not an immutable event log.
 */
export function deriveProgressSnapshot(
  journey: Journey,
  history: readonly ProgressSourceDay[],
  asOfLocalDate: LocalDate,
  journeyStartLocalDate: LocalDate,
): ProgressSnapshot {
  const days = new Map<LocalDate, ProgressDay>()
  let totalActions = 0
  let completedActions = 0
  let activeDays = 0
  let fullyCompletedDays = 0

  // Repository guarantees one plan per date and unique plan IDs.
  for (const { plan, steps } of history) {
    if (plan.journeyId !== journey.id || plan.localDate > asOfLocalDate) continue
    const completedSteps = steps.filter(isDailyStepCompleted).length
    const isActive = completedSteps > 0
    const isFullyComplete = validateDailyStepCount(steps).ok && completedSteps === steps.length
    const day: ProgressDay = {
      localDate: plan.localDate, hasPlan: true, isBeforeJourney: false,
      totalSteps: steps.length, completedSteps, isActive, isFullyComplete,
    }
    days.set(plan.localDate, day)
    totalActions += steps.length
    completedActions += completedSteps
    if (isActive) activeDays++
    if (isFullyComplete) fullyCompletedDays++
  }

  const recentDays = Array.from({ length: 7 }, (_, index): ProgressDay => {
    const localDate = addLocalDays(asOfLocalDate, index - 6)
    return days.get(localDate) ?? {
      localDate, hasPlan: false, isBeforeJourney: localDate < journeyStartLocalDate,
      totalSteps: 0, completedSteps: 0, isActive: false, isFullyComplete: false,
    }
  })

  return {
    journeyId: journey.id, asOfLocalDate, planDays: days.size,
    totalActions, completedActions, activeDays, fullyCompletedDays, recentDays,
    recentActiveDays: recentDays.filter((day) => day.isActive).length,
    journeyElapsedDays: Math.max(0, localDaysBetween(journeyStartLocalDate, asOfLocalDate) + 1),
    journeyDurationDays: journey.durationDays,
  }
}

/**
 * Daily Steps application service.
 *
 * This is the single operation that manages today's Daily Steps
 * for the active DailyPlan. It owns the rules:
 *
 *   1. Verify DailyPlan exists (and Today's Win exists)
 *   2. Validate step input
 *   3. Add/edit/remove steps while preserving order and id
 *   4. Enforce 2-4 step limit for new additions
 *   5. Prevent duplicate text
 *   5. Persist safely
 *
 * React must not contain these rules. A component that re-implements them
 * is a second implementation that will drift.
 */

import type { DailyStepsRepository } from '../data/repositories/dailyStepsRepository'
import type { DailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import type { TodayWinRepository } from '../data/repositories/todayWinRepository'
import type { JourneyRepository } from '../data/repositories/journeyRepository'
import { createDailyStepId, createDailyStep, updateDailyStep, validateDailyStepText, validateDailyStepCount, isDuplicateDailyStep, isAtMaxDailySteps, type DailyStep } from '../domain/dailyStep'
import { createSystemLocalDateProvider } from '../domain/localDate'

export type DailyStepsResult =
  | { readonly ok: true; readonly steps: DailyStep[] }
  | { readonly ok: false; readonly problem: DailyStepsProblem; readonly message: string }

export type DailyStepsProblem =
  | 'no-journey'
  | 'no-daily-plan'
  | 'no-today-win'
  | 'invalid-text'
  | 'duplicate-step'
  | 'too-many-steps'
  | 'step-not-found'
  | 'newer-steps-schema'
  | 'storage-unavailable'
  | 'unknown'

/**
 * Loads today's Daily Steps for the active DailyPlan.
 */
export function loadDailySteps(
  planRepository: DailyPlanRepository,
  stepsRepository: DailyStepsRepository,
  journeyRepository: JourneyRepository,
): DailyStep[] {
  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const journey = journeyRepository.loadActive()
  if (!journey) return []

  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) return []

  return stepsRepository.loadForPlan(todayPlan.id)
}

/**
 * Adds a new Daily Step to today's plan.
 */
export async function addDailyStep(
  planRepository: DailyPlanRepository,
  stepsRepository: DailyStepsRepository,
  journeyRepository: JourneyRepository,
  winRepository: TodayWinRepository,
  text: string,
): Promise<{ ok: true; steps: DailyStep[] } | { ok: false; problem: DailyStepsProblem; message: string }> {
  // 1. Validate text
  const validation = validateDailyStepText(text)
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

  if (!winRepository.loadForPlan(todayPlan.id)) {
    return { ok: false, problem: 'no-today-win', message: 'Set Today\'s Win before adding steps.' }
  }

  // 3c. Load existing steps
  const existingSteps = stepsRepository.loadForPlan(todayPlan.id)

  // 4. Check duplicate
  if (isDuplicateDailyStep(existingSteps, text)) {
    return { ok: false, problem: 'duplicate-step', message: 'This step already exists.' }
  }

  // 5. Check max steps
  if (isAtMaxDailySteps(existingSteps)) {
    return { ok: false, problem: 'too-many-steps', message: 'Keep it to 4 steps or fewer.' }
  }

  // 4. Add new step
  const stepId = createDailyStepId()
  const newStep = createDailyStep(text.trim(), new Date().toISOString(), stepId)
  const newSteps = [...existingSteps, newStep]

  // Validate step count
  const countValidation = validateDailyStepCount(newSteps)
  if (countValidation.state === 'too-many') {
    return { ok: false, problem: 'too-many-steps', message: countValidation.message }
  }

  // 5. Persist the steps
  const saveResult = stepsRepository.save(todayPlan.id, newSteps)

  if (saveResult === 'newer-schema') {
    return { ok: false, problem: 'newer-steps-schema', message: 'A newer steps list exists.' }
  }

  if (saveResult !== 'ok') {
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save Daily Steps.' }
  }

  return { ok: true, steps: newSteps }
}

export async function editDailyStep(
  stepsRepository: DailyStepsRepository,
  planRepository: DailyPlanRepository,
  journeyRepository: JourneyRepository,
  winRepository: TodayWinRepository,
  stepId: string,
  newText: string,
): Promise<{ ok: true; steps: DailyStep[] } | { ok: false; problem: DailyStepsProblem; message: string }> {
  // Validate text
  const validation = validateDailyStepText(newText)
  if (!validation.ok) {
    return { ok: false, problem: 'invalid-text', message: validation.message }
  }

  // Load current steps
  const journey = journeyRepository.loadActive()
  if (!journey) {
    return { ok: false, problem: 'no-journey', message: 'No active Journey exists.' }
  }

  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) {
    return { ok: false, problem: 'no-daily-plan', message: 'No active DailyPlan exists.' }
  }

  if (!winRepository.loadForPlan(todayPlan.id)) {
    return { ok: false, problem: 'no-today-win', message: 'Set Today\'s Win before editing steps.' }
  }

  const currentSteps = stepsRepository.loadForPlan(todayPlan.id)
  const stepIndex = currentSteps.findIndex(s => s.id === stepId)
  if (stepIndex === -1) {
    return { ok: false, problem: 'step-not-found', message: 'Step not found.' }
  }

  // Check duplicate
  if (isDuplicateDailyStep(currentSteps, newText, stepId)) {
    return { ok: false, problem: 'duplicate-step', message: 'This step already exists.' }
  }

  const updatedSteps = currentSteps.map((step, index) =>
    index === stepIndex ? updateDailyStep(step, newText.trim()) : step
  )

  const saveResult = stepsRepository.save(todayPlan.id, updatedSteps)

  if (saveResult === 'newer-schema') {
    return { ok: false, problem: 'newer-steps-schema', message: 'A newer steps list exists.' }
  }

  if (saveResult !== 'ok') {
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save Daily Steps.' }
  }

  return { ok: true, steps: updatedSteps }
}

export async function removeDailyStep(
  stepsRepository: DailyStepsRepository,
  planRepository: DailyPlanRepository,
  journeyRepository: JourneyRepository,
  winRepository: TodayWinRepository,
  stepId: string,
): Promise<{ ok: true; steps: DailyStep[] } | { ok: false; problem: DailyStepsProblem; message: string }> {
  // Load current steps
  const journey = journeyRepository.loadActive()
  if (!journey) {
    return { ok: false, problem: 'no-journey', message: 'No active Journey exists.' }
  }

  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) {
    return { ok: false, problem: 'no-daily-plan', message: 'No active DailyPlan exists.' }
  }

  if (!winRepository.loadForPlan(todayPlan.id)) {
    return { ok: false, problem: 'no-today-win', message: 'Set Today\'s Win before removing steps.' }
  }

  const currentSteps = stepsRepository.loadForPlan(todayPlan.id)
  const stepIndex = currentSteps.findIndex(s => s.id === stepId)
  if (stepIndex === -1) {
    return { ok: false, problem: 'step-not-found', message: 'Step not found.' }
  }

  const updatedSteps = currentSteps.filter((_, index) => index !== stepIndex)

  const saveResult = stepsRepository.save(todayPlan.id, updatedSteps)

  if (saveResult === 'newer-schema') {
    return { ok: false, problem: 'newer-steps-schema', message: 'A newer steps list exists.' }
  }

  if (saveResult !== 'ok') {
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save Daily Steps.' }
  }

  return { ok: true, steps: updatedSteps }
}

export function canLoadDailySteps(
  planRepository: DailyPlanRepository,
  stepsRepository: DailyStepsRepository,
  journeyRepository: JourneyRepository,
): { readonly can: boolean; readonly reason?: string } {
  const journey = journeyRepository.loadActive()
  if (!journey) return { can: false, reason: 'no-journey' }

  const localDateProvider = createSystemLocalDateProvider()
  const localDate = localDateProvider.today()
  const todayPlan = planRepository.loadForDate(journey.id, localDate)
  if (!todayPlan) return { can: false, reason: 'no-daily-plan' }

  if (!stepsRepository.isAvailable()) return { can: false, reason: 'storage-unavailable' }

  return { can: true }
}

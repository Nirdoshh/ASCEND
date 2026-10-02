import { createJourneyFromDraft } from '../domain/journey'
import { createDailyPlan } from '../domain/dailyPlan'
import { createDailyStep, completeDailyStep } from '../domain/dailyStep'
import type { ProgressSourceDay } from '../domain/progress'

export const PROGRESS_NOW = '2026-10-11T09:00:00.000Z'

export function progressJourney(startedAt = '2026-10-01T09:00:00.000Z', id = 'jr_progress') {
  return createJourneyFromDraft({
    selectedGrowthAreaIds: [], customGrowthAreas: [],
    goal: { text: 'Walk more often' }, why: { text: 'Time outside matters to me' },
    durationDays: 45, milestones: [{ id: 'ms_walk', text: 'A longer walk' }], dailyEffortMinutes: 15,
  }, [], startedAt, id)
}

export function progressSourceDay(
  localDate: string,
  completions: readonly boolean[] = [],
  journeyId = 'jr_progress',
): ProgressSourceDay {
  const plan = createDailyPlan(journeyId, localDate, PROGRESS_NOW, `dp_${journeyId}_${localDate}`)
  const steps = completions.map((completed, index) => {
    const step = createDailyStep(`Action ${index + 1}`, PROGRESS_NOW, `ds_${localDate}_${index}`)
    return completed ? completeDailyStep(step, PROGRESS_NOW) : step
  })
  return { plan, steps }
}

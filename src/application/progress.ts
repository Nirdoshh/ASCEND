import type { JourneyRepository } from '../data/repositories/journeyRepository'
import type { DailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import type { DailyStepsRepository } from '../data/repositories/dailyStepsRepository'
import type { RepositoryReadResult } from '../data/repositories/readResult'
import {
  createSystemLocalDateProvider, localDateFromTimestamp, type LocalDateProvider,
} from '../domain/localDate'
import { deriveProgressSnapshot, type ProgressSnapshot, type ProgressSourceDay } from '../domain/progress'

export type ProgressResult = RepositoryReadResult<ProgressSnapshot | null>

/** Read-only orchestration. No plan creation, writes, counters, or synchronization. */
export function loadProgress(
  journeyRepository: JourneyRepository,
  planRepository: DailyPlanRepository,
  stepsRepository: DailyStepsRepository,
  dateProvider: LocalDateProvider = createSystemLocalDateProvider(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): ProgressResult {
  const journey = journeyRepository.readActive()
  if (!journey.ok) return journey
  if (journey.value === null) return { ok: true, value: null }
  const plans = planRepository.listForJourney(journey.value.id)
  if (!plans.ok) return plans
  const asOfLocalDate = dateProvider.today()
  const history: ProgressSourceDay[] = []
  for (const plan of plans.value) {
    if (plan.localDate > asOfLocalDate) continue
    const steps = stepsRepository.readForPlan(plan.id)
    if (!steps.ok) return steps
    history.push({ plan, steps: steps.value })
  }
  return {
    ok: true,
    value: deriveProgressSnapshot(
      journey.value, history, asOfLocalDate, localDateFromTimestamp(journey.value.startedAt, timeZone),
    ),
  }
}

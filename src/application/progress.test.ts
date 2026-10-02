import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadProgress } from './progress'
import { createWebStorageStore } from '../data/storage'
import { createJourneyRepository } from '../data/repositories/journeyRepository'
import { createDailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import { createDailyStepsRepository } from '../data/repositories/dailyStepsRepository'
import { createFixedLocalDateProvider } from '../domain/localDate'
import { dailyPlanStorageKey } from '../domain/dailyPlan'
import { dailyStepsStorageKey, uncompleteDailyStep } from '../domain/dailyStep'
import { progressJourney, progressSourceDay } from '../test/progressFixtures'

beforeEach(() => window.localStorage.clear())

function repositories(store = createWebStorageStore()) {
  return {
    journey: createJourneyRepository(store), plans: createDailyPlanRepository(store), steps: createDailyStepsRepository(store),
  }
}

const dateProvider = createFixedLocalDateProvider('2026-10-11')
const load = (repos: ReturnType<typeof repositories>, timeZone = 'UTC') =>
  loadProgress(repos.journey, repos.plans, repos.steps, dateProvider, timeZone)

function seedDay(date: string, completions: boolean[], journeyId = 'jr_progress') {
  const source = progressSourceDay(date, completions, journeyId)
  window.localStorage.setItem(dailyPlanStorageKey(journeyId, date), JSON.stringify(source.plan))
  window.localStorage.setItem(dailyStepsStorageKey(source.plan.id), JSON.stringify(source.steps))
  return source
}

describe('Progress application service', () => {
  it('reports no active Journey without creating anything', () => {
    const repos = repositories()
    expect(load(repos)).toEqual({ ok: true, value: null })
    expect(window.localStorage.length).toBe(0)
  })

  it('derives no-history Journey time without creating a DailyPlan or summary', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    const count = window.localStorage.length
    expect(load(repos)).toMatchObject({ ok: true, value: { totalActions: 0, planDays: 0, journeyElapsedDays: 11 } })
    expect(window.localStorage.length).toBe(count)
  })

  it('reads only the active Journey’s plans and their associated Steps', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    seedDay('2026-10-08', [true, false])
    seedDay('2026-10-11', [true, true, false])
    const other = seedDay('2026-10-11', [true, true], 'jr_other')
    window.localStorage.setItem(dailyStepsStorageKey(other.plan.id), '{broken')
    const read = vi.spyOn(repos.steps, 'readForPlan')
    expect(load(repos)).toMatchObject({ ok: true, value: { totalActions: 5, completedActions: 3, activeDays: 2 } })
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).not.toHaveBeenCalledWith(other.plan.id)
  })

  it('counts a plan with missing Steps as an empty day', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    const { plan } = seedDay('2026-10-11', [])
    window.localStorage.removeItem(dailyStepsStorageKey(plan.id))
    expect(load(repos)).toMatchObject({ ok: true, value: { planDays: 1, totalActions: 0, fullyCompletedDays: 0 } })
  })

  it('recalculates from changed completion records, with no synchronization routine', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    const source = seedDay('2026-10-11', [true, true])
    expect(load(repos)).toMatchObject({ ok: true, value: { completedActions: 2, fullyCompletedDays: 1 } })
    repos.steps.save(source.plan.id, source.steps.map(uncompleteDailyStep))
    expect(load(repos)).toMatchObject({ ok: true, value: { completedActions: 0, activeDays: 0, fullyCompletedDays: 0 } })
  })

  it('uses local Journey start semantics instead of the UTC date prefix', () => {
    const repos = repositories()
    repos.journey.save(progressJourney('2026-10-01T23:30:00Z'))
    expect(load(repos, 'Asia/Katmandu')).toMatchObject({ ok: true, value: { journeyElapsedDays: 10 } })
    expect(load(repos, 'America/Los_Angeles')).toMatchObject({ ok: true, value: { journeyElapsedDays: 11 } })
  })

  it('excludes future-dated Steps without interpreting them', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    const future = seedDay('2026-10-12', [true, true])
    window.localStorage.setItem(dailyStepsStorageKey(future.plan.id), '{broken')
    expect(load(repos)).toMatchObject({ ok: true, value: { planDays: 0, completedActions: 0 } })
  })

  it.each(['plans', 'steps'] as const)('refuses misleading partial totals when %s history is malformed', target => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    seedDay('2026-10-08', [true, true])
    const source = seedDay('2026-10-11', [true, false])
    const key = target === 'plans' ? dailyPlanStorageKey('jr_progress', '2026-10-11') : dailyStepsStorageKey(source.plan.id)
    window.localStorage.setItem(key, '{broken')
    expect(load(repos)).toEqual({ ok: false, problem: 'invalid-data' })
    expect(window.localStorage.getItem(key)).toBe('{broken')
  })

  it('returns unavailable rather than treating a failed read as an empty Journey', () => {
    expect(load(repositories(createWebStorageStore(null)))).toEqual({ ok: false, problem: 'storage-unavailable' })
  })

  it('reports storage failure during Step reads', () => {
    const repos = repositories()
    repos.journey.save(progressJourney())
    seedDay('2026-10-11', [true, false])
    vi.spyOn(repos.steps, 'readForPlan').mockReturnValue({ ok: false, problem: 'storage-unavailable' })
    expect(load(repos)).toEqual({ ok: false, problem: 'storage-unavailable' })
  })

  it('performs no writes or removals, including source normalization', () => {
    const repos = repositories(createWebStorageStore(window.localStorage))
    repos.journey.save(progressJourney())
    seedDay('2026-10-11', [true, false])
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    expect(load(repos).ok).toBe(true)
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

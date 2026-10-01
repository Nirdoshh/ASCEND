import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { createJourneyRepository } from '../data/repositories/journeyRepository'
import { createDailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import { createWebStorageStore } from '../data/storage'
import { createJourneyFromDraft } from '../domain/journey'
import { knownGrowthAreas } from '../domain/onboardingDraft'
import { createDailyPlan, createDailyPlanId } from '../domain/dailyPlan'
import { getOrCreateTodayPlan, loadTodayPlan, canLoadTodayPlan, type TodayPlanResult } from '../application/todayPlan'
import { createFixedLocalDateProvider } from '../domain/localDate'

const T0 = '2026-10-01T09:00:00.000Z'
const FITNESS = 'ga_s_fitness'

function createJourney() {
  const draft = {
    selectedGrowthAreaIds: [FITNESS],
    customGrowthAreas: [],
    goal: { text: 'Run my first 10K' },
    why: { text: 'Because I can' },
    durationDays: 30,
    milestones: [{ id: 'ms_first', text: 'Run 5 km' }],
    dailyEffortMinutes: 20,
  }
  const areas = knownGrowthAreas(draft as any)
  return createJourneyFromDraft(draft, areas, T0, 'jr_test1234567890')
}

function createRepo() {
  const store = createWebStorageStore()
  return {
    journey: createJourneyRepository(store),
    plan: createDailyPlanRepository(store),
  }
}

function seedJourney(journeyRepo: ReturnType<typeof createJourneyRepository>) {
  journeyRepo.save(createJourney())
}

/** Type guard to narrow TodayPlanResult to success case. */
function isSuccess(result: TodayPlanResult): result is { readonly ok: true; readonly plan: import('../domain/dailyPlan').DailyPlan; readonly isNew: boolean } {
  return result.ok === true
}

/** Type guard to narrow TodayPlanResult to failure case. */
function isFailure(result: TodayPlanResult): result is { readonly ok: false; readonly problem: import('../application/todayPlan').TodayPlanProblem; readonly message: string } {
  return result.ok === false
}

describe('getOrCreateTodayPlan', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(T0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns no-journey when no active Journey exists', async () => {
    const { journey, plan } = createRepo()
    const provider = createFixedLocalDateProvider('2026-10-01')

    const result = await getOrCreateTodayPlan(journey, plan, provider, T0)

    if (!isFailure(result)) throw new Error('Expected failure')
    expect(result.problem).toBe('no-journey')
  })

  it('creates a new plan when Journey exists and no plan exists', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const provider = createFixedLocalDateProvider('2026-10-01')

    const result = await getOrCreateTodayPlan(journey, plan, provider, T0)

    if (!isSuccess(result)) throw new Error('Expected success')
    expect(result.isNew).toBe(true)
    expect(result.plan.journeyId).toBe('jr_test1234567890')
    expect(result.plan.localDate).toBe('2026-10-01')
    expect(result.plan.id.startsWith('dp_')).toBe(true)
  })

  it('returns existing plan on repeated calls', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const provider = createFixedLocalDateProvider('2026-10-01')

    const first = await getOrCreateTodayPlan(journey, plan, provider, T0)
    if (!isSuccess(first)) throw new Error('Expected success')
    expect(first.isNew).toBe(true)

    const second = await getOrCreateTodayPlan(journey, plan, provider, T0)
    if (!isSuccess(second)) throw new Error('Expected success')
    expect(second.isNew).toBe(false)
    expect(second.plan.id).toBe(first.plan.id)
  })

  it('returns same plan for same date across multiple calls', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const provider = createFixedLocalDateProvider('2026-10-01')

    const results = await Promise.all([
      getOrCreateTodayPlan(journey, plan, provider, T0),
      getOrCreateTodayPlan(journey, plan, provider, T0),
      getOrCreateTodayPlan(journey, plan, provider, T0),
    ])

    // Check all succeeded and collect plans
    const plans: import('../domain/dailyPlan').DailyPlan[] = []
    for (const r of results) {
      if (!isSuccess(r)) throw new Error('Expected success')
      plans.push(r.plan)
    }
    const ids = plans.map((p) => p.id)
    expect(new Set(ids).size).toBe(1)
  })

  it('creates different plans for different dates', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)

    const day1 = await getOrCreateTodayPlan(journey, plan, createFixedLocalDateProvider('2026-10-01'), T0)
    const day2 = await getOrCreateTodayPlan(journey, plan, createFixedLocalDateProvider('2026-10-02'), T0)
    const day3 = await getOrCreateTodayPlan(journey, plan, createFixedLocalDateProvider('2026-10-03'), T0)

    if (!isSuccess(day1) || !isSuccess(day2) || !isSuccess(day3)) throw new Error('Expected success')
    expect(day1.plan.localDate).toBe('2026-10-01')
    expect(day2.plan.localDate).toBe('2026-10-02')
    expect(day3.plan.localDate).toBe('2026-10-03')
    expect(day1.plan.id).not.toBe(day2.plan.id)
    expect(day2.plan.id).not.toBe(day3.plan.id)
  })

  it('creates different plans for different Journeys on same date', async () => {
    const { plan } = createRepo()

    // The getOrCreateTodayPlan uses journeyRepository which only stores one journey.
    // Test the core isolation by directly using the plan repository.
    const planId1 = createDailyPlanId()
    const plan1 = createDailyPlan('jr_journey1', '2026-10-01', T0, planId1)
    const planId2 = createDailyPlanId()
    const plan2 = createDailyPlan('jr_journey2', '2026-10-01', T0, planId2)

    await plan.getOrCreate('jr_journey1', '2026-10-01', plan1)
    await plan.getOrCreate('jr_journey2', '2026-10-01', plan2)

    const loaded1 = plan.loadForDate('jr_journey1', '2026-10-01')
    const loaded2 = plan.loadForDate('jr_journey2', '2026-10-01')

    expect(loaded1?.journeyId).toBe('jr_journey1')
    expect(loaded2?.journeyId).toBe('jr_journey2')
    expect(loaded1?.id).not.toBe(loaded2?.id)
  })

  it('returns storage-unavailable when storage fails', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const provider = createFixedLocalDateProvider('2026-10-01')

    // Make storage fail
    vi.spyOn(plan, 'getOrCreate').mockResolvedValue({ result: 'unavailable', plan: null })

    const result = await getOrCreateTodayPlan(journey, plan, provider, T0)

    if (!isFailure(result)) throw new Error('Expected failure')
    expect(result.problem).toBe('storage-unavailable')
  })
})

describe('loadTodayPlan', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(T0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when no Journey exists', () => {
    const { journey, plan } = createRepo()
    const provider = createFixedLocalDateProvider('2026-10-01')

    const result = loadTodayPlan(journey, plan, provider)
    expect(result).toBeNull()
  })

  it('returns null when no plan exists for today', () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const provider = createFixedLocalDateProvider('2026-10-01')

    const result = loadTodayPlan(journey, plan, provider)
    expect(result).toBeNull()
  })

  it('returns plan when it exists', async () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)

    // Pre-create a plan
    const existing = await getOrCreateTodayPlan(journey, plan, createFixedLocalDateProvider('2026-10-01'), T0)
    if (!isSuccess(existing)) throw new Error('Expected success')

    const loaded = loadTodayPlan(journey, plan, createFixedLocalDateProvider('2026-10-01'))

    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe(existing.plan.id)
  })
})

describe('canLoadTodayPlan', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns false when no Journey exists', () => {
    const { journey, plan } = createRepo()
    const result = canLoadTodayPlan(journey, plan)
    expect(result.can).toBe(false)
    if (!result.can) {
      expect(result.reason).toBe('no-journey')
    }
  })

  it('returns true when Journey exists and storage available', () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    const result = canLoadTodayPlan(journey, plan)
    expect(result.can).toBe(true)
  })

  it('returns false when storage unavailable', () => {
    const { journey, plan } = createRepo()
    seedJourney(journey)
    vi.spyOn(plan, 'isAvailable').mockReturnValue(false)
    const result = canLoadTodayPlan(journey, plan)
    expect(result.can).toBe(false)
    if (!result.can) {
      expect(result.reason).toBe('storage-unavailable')
    }
  })
})
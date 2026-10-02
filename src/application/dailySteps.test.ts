import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDailyPlanRepository } from '../data/repositories/dailyPlanRepository'
import { createDailyStepsRepository } from '../data/repositories/dailyStepsRepository'
import { createJourneyRepository } from '../data/repositories/journeyRepository'
import { createTodayWinRepository } from '../data/repositories/todayWinRepository'
import { createWebStorageStore } from '../data/storage'
import { createJourneyFromDraft } from '../domain/journey'
import { knownGrowthAreas } from '../domain/onboardingDraft'
import { getOrCreateTodayPlan } from '../application/todayPlan'
import { setTodayWin } from '../application/todayWin'
import {
  addDailyStep,
  completeDailyStep,
  editDailyStep,
  loadDailySteps,
  removeDailyStep,
  uncompleteDailyStep,
} from '../application/dailySteps'
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

describe('dailySteps application service', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T09:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createRepo() {
    const store = createWebStorageStore()
    return {
      journey: createJourneyRepository(store),
      plan: createDailyPlanRepository(store),
      steps: createDailyStepsRepository(store),
      win: createTodayWinRepository(store),
    }
  }

  function seedJourney(journeyRepo: ReturnType<typeof createJourneyRepository>) {
    journeyRepo.save(createJourney())
  }

  async function setupJourneyAndWin(journeyRepo: ReturnType<typeof createJourneyRepository>, planRepo: ReturnType<typeof createDailyPlanRepository>, winRepo: ReturnType<typeof createTodayWinRepository>) {
    seedJourney(journeyRepo)
    const planResult = await getOrCreateTodayPlan(journeyRepo, planRepo, createFixedLocalDateProvider('2026-10-01'), T0)
    if (!planResult.ok) throw new Error('Failed to create plan')

    const winResult = await setTodayWin(journeyRepo, planRepo, winRepo, 'Deploy the auth flow', T0)
    if (!winResult.ok) throw new Error('Failed to set win')
    return planResult.plan
  }

  describe('loadDailySteps', () => {
    it('returns empty array when no journey exists', () => {
      const { journey, plan, steps } = createRepo()
      const result = loadDailySteps(plan, steps, journey)
      expect(result).toEqual([])
    })

    it('returns empty array when no daily plan exists', () => {
      const { journey, plan, steps } = createRepo()
      seedJourney(journey)
      const result = loadDailySteps(plan, steps, journey)
      expect(result).toEqual([])
    })
  })

  it('refuses to add without a Journey, DailyPlan, or Today\'s Win', async () => {
    const empty = createRepo()
    expect(await addDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'First action')).toMatchObject({ ok: false, problem: 'no-journey' })

    seedJourney(empty.journey)
    expect(await addDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'First action')).toMatchObject({ ok: false, problem: 'no-daily-plan' })

    await getOrCreateTodayPlan(empty.journey, empty.plan, createFixedLocalDateProvider('2026-10-01'), T0)
    expect(await addDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'First action')).toMatchObject({ ok: false, problem: 'no-today-win' })
  })

  it('adds steps 1 through 4 in order and refuses a fifth', async () => {
    const repositories = createRepo()
    const plan = await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    const texts = ['Open the project', 'Fix the first bug', 'Run the tests', 'Deploy the build']
    const ids: string[] = []

    for (const text of texts) {
      const result = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, text)
      if (!result.ok) throw new Error('Expected step to be added')
      const last = result.steps[result.steps.length - 1]
      if (!last) throw new Error('Expected a new step')
      ids.push(last.id)
    }

    expect(await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Celebrate')).toMatchObject({ ok: false, problem: 'too-many-steps' })
    expect(repositories.steps.loadForPlan(plan.id).map(step => step.text)).toEqual(texts)
    expect(new Set(ids).size).toBe(4)
  })

  it('rejects blank and duplicate text, including Unicode and outer whitespace', async () => {
    const repositories = createRepo()
    await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    expect(await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, '   ')).toMatchObject({ ok: false, problem: 'invalid-text' })
    expect(await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, '  Ship the ��� build  ')).toMatchObject({ ok: true })
    expect(await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'ship the ��� build')).toMatchObject({ ok: false, problem: 'duplicate-step' })
  })

  it('edits in place, preserves id, rejects duplicate edits, and removes in order', async () => {
    const repositories = createRepo()
    await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    const first = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Second action')
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Third action')
    if (!first.ok) throw new Error('Expected first step')

    const firstId = first.steps[0]?.id
    if (!firstId) throw new Error('Expected first id')
    const edited = await editDailyStep(repositories.steps, repositories.plan, repositories.journey, repositories.win, firstId, '  Edited action  ')
    if (!edited.ok) throw new Error('Expected edit to succeed')
    expect(edited.steps[0]?.id).toBe(firstId)
    expect(edited.steps.map(step => step.text)).toEqual(['Edited action', 'Second action', 'Third action'])

    expect(await editDailyStep(repositories.steps, repositories.plan, repositories.journey, repositories.win, firstId, 'Second action')).toMatchObject({ ok: false, problem: 'duplicate-step' })
    const removed = await removeDailyStep(repositories.steps, repositories.plan, repositories.journey, repositories.win, firstId)
    if (!removed.ok) throw new Error('Expected remove to succeed')
    expect(removed.steps.map(step => step.text)).toEqual(['Second action', 'Third action'])
  })

  it('completes, preserves, and uncompletes steps without changing order', async () => {
    const repositories = createRepo()
    const plan = await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    const first = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')
    const second = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Second action')
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Third action')
    if (!first.ok) throw new Error('Expected first step')
    const firstId = first.steps[0]?.id
    const secondId = second.ok ? second.steps[1]?.id : undefined
    if (!firstId || !secondId) throw new Error('Expected step ids')

    const completed = await completeDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, firstId, T0)
    expect(completed).toMatchObject({ ok: true })
    if (!completed.ok) throw new Error('Expected completion to succeed')
    expect(completed.steps.map((step) => step.id)).toEqual([firstId, secondId, completed.steps[2]?.id])
    expect(completed.steps[0]?.completedAt).toBe(T0)
    expect(completed.steps[1]?.completedAt).toBeNull()

    const completeAgain = await completeDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, firstId, '2026-10-01T10:00:00.000Z')
    if (!completeAgain.ok) throw new Error('Expected repeat completion to succeed')
    expect(completeAgain.steps[0]?.completedAt).toBe(T0)

    const uncompleted = await uncompleteDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, firstId)
    if (!uncompleted.ok) throw new Error('Expected uncompletion to succeed')
    expect(uncompleted.steps.map((step) => step.id)).toEqual([firstId, secondId, uncompleted.steps[2]?.id])
    expect(uncompleted.steps[0]?.completedAt).toBeNull()
    expect(repositories.steps.loadForPlan(plan.id).map((step) => step.id)).toEqual([firstId, secondId, uncompleted.steps[2]?.id])
  })

  it('requires Journey, plan, Win, and an existing step to complete', async () => {
    const empty = createRepo()
    expect(await completeDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'ds_missing', T0)).toMatchObject({ ok: false, problem: 'no-journey' })

    seedJourney(empty.journey)
    expect(await completeDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'ds_missing', T0)).toMatchObject({ ok: false, problem: 'no-daily-plan' })

    await getOrCreateTodayPlan(empty.journey, empty.plan, createFixedLocalDateProvider('2026-10-01'), T0)
    expect(await completeDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'ds_missing', T0)).toMatchObject({ ok: false, problem: 'no-today-win' })

    await setTodayWin(empty.journey, empty.plan, empty.win, 'Deploy the auth flow', T0)
    expect(await completeDailyStep(empty.plan, empty.steps, empty.journey, empty.win, 'ds_missing', T0)).toMatchObject({ ok: false, problem: 'step-not-found' })
  })

  it('keeps completion while editing, removes completed steps, and starts new steps incomplete', async () => {
    const repositories = createRepo()
    await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    const first = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Second action')
    if (!first.ok) throw new Error('Expected first step')
    const firstId = first.steps[0]?.id
    if (!firstId) throw new Error('Expected first id')

    await completeDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, firstId, T0)
    const edited = await editDailyStep(repositories.steps, repositories.plan, repositories.journey, repositories.win, firstId, 'Edited action')
    if (!edited.ok) throw new Error('Expected edit to succeed')
    expect(edited.steps[0]?.completedAt).toBe(T0)

    const removed = await removeDailyStep(repositories.steps, repositories.plan, repositories.journey, repositories.win, firstId)
    if (!removed.ok) throw new Error('Expected removal to succeed')
    expect(removed.steps).toHaveLength(1)

    const added = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'New action')
    if (!added.ok) throw new Error('Expected add to succeed')
    expect(added.steps.at(-1)?.completedAt).toBeNull()
  })

  it('preserves steps when Today\'s Win is edited', async () => {
    const repositories = createRepo()
    const plan = await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')
    await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Second action')
    const before = repositories.steps.loadForPlan(plan.id)

    const result = await setTodayWin(repositories.journey, repositories.plan, repositories.win, 'Updated win', T0)
    expect(result.ok).toBe(true)
    expect(repositories.steps.loadForPlan(plan.id)).toEqual(before)
  })

  it('returns storage-unavailable when saving fails', async () => {
    const repositories = createRepo()
    await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    vi.spyOn(repositories.steps, 'save').mockReturnValue('unavailable')
    expect(await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')).toMatchObject({ ok: false, problem: 'storage-unavailable' })
  })

  it('does not report completion success when persistence fails', async () => {
    const repositories = createRepo()
    await setupJourneyAndWin(repositories.journey, repositories.plan, repositories.win)
    const added = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'First action')
    const second = await addDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, 'Second action')
    if (!added.ok) throw new Error('Expected step to be added')
    const stepId = added.steps[0]?.id
    const secondId = second.ok ? second.steps[1]?.id : undefined
    if (!stepId || !secondId) throw new Error('Expected step ids')

    await completeDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, stepId, T0)
    vi.spyOn(repositories.steps, 'save').mockReturnValue('unavailable')
    expect(await completeDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, secondId, T0)).toMatchObject({ ok: false, problem: 'storage-unavailable' })
    expect(await uncompleteDailyStep(repositories.plan, repositories.steps, repositories.journey, repositories.win, stepId)).toMatchObject({ ok: false, problem: 'storage-unavailable' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebStorageStore } from '../storage'
import { ASCEND_JOURNEY_KEY } from '../storage/keys'
import { createDailyPlanRepository } from './dailyPlanRepository'
import { createDailyStepsRepository } from './dailyStepsRepository'
import { createJourneyRepository } from './journeyRepository'
import { dailyPlanStorageKey } from '../../domain/dailyPlan'
import { dailyStepsStorageKey } from '../../domain/dailyStep'
import { progressJourney, progressSourceDay } from '../../test/progressFixtures'

beforeEach(() => window.localStorage.clear())

describe('Journey-scoped plan history', () => {
  const repository = () => createDailyPlanRepository(createWebStorageStore())
  const seed = (date: string, journeyId = 'jr_progress') => {
    const { plan } = progressSourceDay(date, [], journeyId)
    window.localStorage.setItem(dailyPlanStorageKey(journeyId, date), JSON.stringify(plan))
    return plan
  }

  it('returns no history for missing records', () => {
    expect(repository().listForJourney('jr_progress')).toEqual({ ok: true, value: [] })
  })

  it('isolates Journey keys, validates their identity, and sorts dates', () => {
    const later = seed('2026-10-11')
    const earlier = seed('2026-10-01')
    seed('2026-10-01', 'jr_progress_other')
    window.localStorage.setItem('unrelated:private', 'unreadable unrelated value')
    expect(repository().listForJourney('jr_progress')).toEqual({ ok: true, value: [earlier, later] })
    expect(window.localStorage.getItem('unrelated:private')).toBe('unreadable unrelated value')
  })

  it.each([
    ['broken JSON', '{broken', 'invalid-data'],
    ['JSON null', 'null', 'invalid-data'],
    ['malformed fields', JSON.stringify({ schemaVersion: 1 }), 'invalid-data'],
    ['future schema', JSON.stringify({ schemaVersion: 99 }), 'newer-schema'],
    ['invalid calendar date', JSON.stringify(progressSourceDay('2026-02-30').plan), 'invalid-data'],
    ['wrong Journey', JSON.stringify(progressSourceDay('2026-10-11', [], 'jr_other').plan), 'invalid-data'],
    ['wrong date', JSON.stringify(progressSourceDay('2026-10-10').plan), 'invalid-data'],
  ])('reports %s without modifying any bytes', (_label, raw, problem) => {
    const key = dailyPlanStorageKey('jr_progress', '2026-10-11')
    seed('2026-10-01')
    window.localStorage.setItem(key, raw)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    const repo = createDailyPlanRepository(createWebStorageStore(window.localStorage))
    expect(repo.listForJourney('jr_progress')).toEqual({ ok: false, problem })
    expect(window.localStorage.getItem(key)).toBe(raw)
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('refuses duplicate plan IDs that would double-count the same Steps', () => {
    const first = seed('2026-10-01')
    const second = { ...progressSourceDay('2026-10-11').plan, id: first.id }
    window.localStorage.setItem(dailyPlanStorageKey('jr_progress', second.localDate), JSON.stringify(second))
    expect(repository().listForJourney('jr_progress')).toEqual({ ok: false, problem: 'invalid-data' })
  })

  it('handles a record removed between key enumeration and read', () => {
    const plan = seed('2026-10-11')
    const store = createWebStorageStore()
    const read = store.readResult.bind(store)
    vi.spyOn(store, 'readResult').mockImplementation(key => {
      window.localStorage.removeItem(dailyPlanStorageKey(plan.journeyId, plan.localDate))
      return read(key)
    })
    expect(createDailyPlanRepository(store).listForJourney('jr_progress')).toEqual({ ok: true, value: [] })
  })

  it('reports unavailable storage', () => {
    expect(createDailyPlanRepository(createWebStorageStore(null)).listForJourney('jr_progress'))
      .toEqual({ ok: false, problem: 'storage-unavailable' })
  })
})

describe('explicit historical Steps reads', () => {
  const key = dailyStepsStorageKey('dp_history')
  const repository = () => createDailyStepsRepository(createWebStorageStore(window.localStorage))

  it('distinguishes a missing or empty list from an unreadable record', () => {
    expect(repository().readForPlan('dp_history')).toEqual({ ok: true, value: [] })
    window.localStorage.setItem(key, '[]')
    expect(repository().readForPlan('dp_history')).toEqual({ ok: true, value: [] })
  })

  it('reads v1 as open steps without persisting migration', () => {
    const raw = JSON.stringify([{ schemaVersion: 1, id: 'ds_old', text: 'Go outside' }])
    window.localStorage.setItem(key, raw)
    expect(repository().readForPlan('dp_history')).toEqual({
      ok: true, value: [{ schemaVersion: 2, id: 'ds_old', text: 'Go outside', completedAt: null }],
    })
    expect(window.localStorage.getItem(key)).toBe(raw)
  })

  it('preserves over-full v2 history and explicit completion', () => {
    const { steps } = progressSourceDay('2026-10-11', [true, true, false, true, true])
    const raw = JSON.stringify(steps)
    window.localStorage.setItem(key, raw)
    expect(repository().readForPlan('dp_history')).toEqual({ ok: true, value: steps })
    expect(window.localStorage.getItem(key)).toBe(raw)
  })

  it.each([
    ['{broken', 'invalid-data'],
    ['null', 'invalid-data'],
    ['{}', 'invalid-data'],
    [JSON.stringify([{ schemaVersion: 99, id: 'ds_future', text: 'Preserve me' }]), 'newer-schema'],
    [JSON.stringify([{ schemaVersion: 2, id: 'ds_invalid', text: 'Preserve me', completedAt: 'bad' }]), 'invalid-data'],
    [JSON.stringify({ schemaVersion: 99, steps: [] }), 'invalid-data'],
  ])('reports unreadable list %s without rewriting it', (raw, problem) => {
    window.localStorage.setItem(key, raw)
    expect(repository().readForPlan('dp_history')).toEqual({ ok: false, problem })
    expect(window.localStorage.getItem(key)).toBe(raw)
  })

  it('does not read another plan’s steps', () => {
    window.localStorage.setItem(dailyStepsStorageKey('dp_other'), '{broken')
    expect(repository().readForPlan('dp_history')).toEqual({ ok: true, value: [] })
  })

  it('reports unavailable storage', () => {
    expect(createDailyStepsRepository(createWebStorageStore(null)).readForPlan('dp_history'))
      .toEqual({ ok: false, problem: 'storage-unavailable' })
  })
})

describe('explicit active Journey reads', () => {
  it('distinguishes absence and a valid Journey', () => {
    const repo = createJourneyRepository(createWebStorageStore())
    expect(repo.readActive()).toEqual({ ok: true, value: null })
    repo.save(progressJourney())
    expect(repo.readActive()).toEqual({ ok: true, value: progressJourney() })
  })

  it.each([
    ['{broken', 'invalid-data'],
    [JSON.stringify({ ...progressJourney(), schemaVersion: 99 }), 'newer-schema'],
    [JSON.stringify({ ...progressJourney(), startedAt: 'invalid date' }), 'invalid-data'],
    [JSON.stringify({ schemaVersion: 1 }), 'invalid-data'],
  ])('preserves an unreadable Journey %s and never invents a start date', (raw, problem) => {
    window.localStorage.setItem(ASCEND_JOURNEY_KEY, raw)
    const repo = createJourneyRepository(createWebStorageStore())
    expect(repo.readActive()).toEqual({ ok: false, problem })
    expect(window.localStorage.getItem(ASCEND_JOURNEY_KEY)).toBe(raw)
  })
})

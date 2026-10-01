import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { createDailyStepsRepository } from './dailyStepsRepository'
import { createWebStorageStore } from '../storage'
import { createDailyStep } from '../../domain/dailyStep'
import { dailyStepsStorageKey } from '../../domain/dailyStep'
import { type DailyStep } from '../../domain/dailyStep'

const NOW = '2026-10-01T09:00:00.000Z'
const DAILY_PLAN_ID = 'dp_test1234567890'

function createRepo() {
  return createDailyStepsRepository(createWebStorageStore())
}

function createStep(overrides: Partial<{ text: string; id: string }> = {}): DailyStep {
  return createDailyStep(
    overrides.text ?? 'Fix the onboarding routing bug',
    NOW,
    overrides.id ?? 'ds_test1234567890',
  )
}

/**
 * Indexing an array is intentionally unchecked under noUncheckedIndexedAccess.
 * The callers establish the expected length with toHaveLength before asking
 * for a position, while this guard keeps the invariant explicit at runtime.
 */
function stepAt(steps: DailyStep[], index: number): DailyStep {
  const step = steps[index]
  if (!step) throw new Error(`Expected a Daily Step at index ${index}`)
  return step
}

describe('dailyStepsRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadForPlan', () => {
    it('returns empty array when no steps exist', () => {
      const repo = createRepo()
      const steps = repo.loadForPlan(DAILY_PLAN_ID)
      expect(steps).toEqual([])
    })

    it('loads existing steps', () => {
      const repo = createRepo()
      const step1 = createStep({ text: 'Fix the onboarding routing bug' })
      const step2 = createStep({ text: 'Test the full onboarding flow', id: 'ds_test2' })
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify([step1, step2]))

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).not.toBeNull()
      const steps = loaded as DailyStep[]
      expect(steps).toHaveLength(2)
      expect(stepAt(steps, 0).text).toBe('Fix the onboarding routing bug')
      expect(stepAt(steps, 1).text).toBe('Test the full onboarding flow')
    })

    it('returns empty array for future schema', () => {
      const repo = createRepo()
      const step = createStep()
      const futureSteps = [{ ...step, schemaVersion: 999 }]
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureSteps))

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).toEqual([])
    })

    it('returns empty array for corrupt data', () => {
      const repo = createRepo()
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, 'not valid json')

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).toEqual([])
    })

    it('returns empty array for duplicate stored ids or text', () => {
      const repo = createRepo()
      const first = createStep()
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)

      window.localStorage.setItem(key, JSON.stringify([first, { ...first, text: 'Another action' }]))
      expect(repo.loadForPlan(DAILY_PLAN_ID)).toEqual([])

      window.localStorage.setItem(key, JSON.stringify([first, { ...first, id: 'ds_test2', text: '  FIX THE ONBOARDING ROUTING BUG  ' }]))
      expect(repo.loadForPlan(DAILY_PLAN_ID)).toEqual([])
    })

    it('returns empty array for wrong daily plan', () => {
      const repo = createRepo()
      const step = createStep()
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify([step]))

      const loaded = repo.loadForPlan('different_plan')
      expect(loaded).toEqual([])
    })
  })

  describe('save', () => {
    it('saves steps when none exist', async () => {
      const repo = createRepo()
      const stepsToSave = [createStep(), createStep({ text: 'Test the full onboarding flow', id: 'ds_test2' })]

      const result = await repo.save(DAILY_PLAN_ID, stepsToSave)
      expect(result).toBe('ok')

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).not.toBeNull()
      const loadedSteps = loaded as DailyStep[]
      expect(loadedSteps).toHaveLength(2)
      expect(stepAt(loadedSteps, 0).text).toBe('Fix the onboarding routing bug')
    })

    it('overwrites existing steps', async () => {
      const repo = createRepo()
      const existingSteps = [createStep()]
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(existingSteps))

      const newSteps = [createStep({ text: 'New step 1' }), createStep({ text: 'New step 2', id: 'ds_new2' })]
      const result = await repo.save(DAILY_PLAN_ID, newSteps)

      expect(result).toBe('ok')

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).not.toBeNull()
      const loadedSteps = loaded!
      expect(loadedSteps).toHaveLength(2)
      expect(stepAt(loadedSteps, 0).text).toBe('New step 1')
      expect(stepAt(loadedSteps, 1).text).toBe('New step 2')
    })

    it('returns newer-schema if existing steps have future schema', () => {
      const repo = createRepo()
      const futureSteps = [{ ...createStep(), schemaVersion: 999 }]
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureSteps))

      const newSteps = [createStep()]
      const result = repo.save(DAILY_PLAN_ID, newSteps)

      expect(result).toBe('newer-schema')
      expect(window.localStorage.getItem(key)).toBe(JSON.stringify(futureSteps))
    })

    it('preserves an over-full persisted list instead of truncating it', () => {
      const repo = createRepo()
      const overFull = Array.from({ length: 5 }, (_, index) => createStep({
        id: `ds_test${index}`,
        text: `Step ${index + 1}`,
      }))
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(overFull))

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).toHaveLength(5)
      expect(loaded.map(step => step.text)).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'])
    })
  })

  describe('existsForPlan', () => {
    it('returns false when no steps exist', () => {
      const repo = createRepo()
      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(false)
    })

    it('returns true when steps exist', () => {
      const repo = createRepo()
      const step = createStep()
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify([step]))

      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(true)
    })

    it('returns false for future schema', () => {
      const repo = createRepo()
      const step = createStep()
      const futureSteps = [{ ...step, schemaVersion: 999 }]
      const key = dailyStepsStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureSteps))

      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('returns true when storage is available', () => {
      const repo = createRepo()
      expect(repo.isAvailable()).toBe(true)
    })

    it('returns false when storage is null', () => {
      const repo = createDailyStepsRepository(createWebStorageStore(null))
      expect(repo.isAvailable()).toBe(false)
    })
  })
})

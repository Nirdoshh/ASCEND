import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { createDailyPlanRepository } from './dailyPlanRepository'
import { createWebStorageStore } from '../storage'
import { createDailyPlan, createDailyPlanId } from '../../domain/dailyPlan'
import { dailyPlanStorageKey } from '../../domain/dailyPlan'

const NOW = '2026-10-01T09:00:00.000Z'
const JOURNEY_ID = 'jr_test1234567890'
const LOCAL_DATE = '2026-10-01'

function createRepo() {
  return createDailyPlanRepository(createWebStorageStore())
}

function createPlan(overrides: Partial<{ journeyId: string; localDate: string; id: string }> = {}) {
  return createDailyPlan(
    overrides.journeyId ?? 'jr_test1234567890',
    overrides.localDate ?? '2026-10-01',
    NOW,
    overrides.id ?? createDailyPlanId(),
  )
}

describe('dailyPlanRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadForDate', () => {
    it('returns null when no plan exists', () => {
      const repo = createRepo()
      const plan = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(plan).toBeNull()
    })

    it('loads an existing plan', () => {
      const repo = createRepo()
      const plan = createPlan()
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(plan))

      const loaded = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(plan.id)
      expect(loaded?.journeyId).toBe(JOURNEY_ID)
      expect(loaded?.localDate).toBe(LOCAL_DATE)
    })

    it('returns null for future schema', () => {
      const repo = createRepo()
      const plan = createPlan()
      const futurePlan = { ...plan, schemaVersion: 999 }
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(futurePlan))

      const loaded = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(loaded).toBeNull()
    })

    it('returns null for corrupt data', () => {
      const repo = createRepo()
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, 'not valid json')

      const loaded = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(loaded).toBeNull()
    })

    it('returns null for wrong journey/date', () => {
      const repo = createRepo()
      const plan = createPlan()
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(plan))

      const loaded = repo.loadForDate('different_journey', LOCAL_DATE)
      expect(loaded).toBeNull()

      const loaded2 = repo.loadForDate(JOURNEY_ID, '2026-10-02')
      expect(loaded2).toBeNull()
    })
  })

  describe('getOrCreate', () => {
    it('creates a new plan when none exists', async () => {
      const repo = createRepo()
      const plan = createPlan()

      const { result, plan: returnedPlan } = await repo.getOrCreate(JOURNEY_ID, LOCAL_DATE, plan)
      expect(result).toBe('ok')
      expect(returnedPlan).not.toBeNull()
      expect(returnedPlan?.id).toBe(plan.id)

      const loaded = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(plan.id)
    })

    it('returns existing plan when one exists', async () => {
      const repo = createRepo()
      const existingPlan = createPlan({ id: 'dp_existing12345678' })
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(existingPlan))

      const newPlan = createPlan({ id: 'dp_new9876543210' })
      const { result, plan: returnedPlan } = await repo.getOrCreate(JOURNEY_ID, LOCAL_DATE, newPlan)

      expect(result).toBe('ok')
      expect(returnedPlan).not.toBeNull()
      expect(returnedPlan?.id).toBe('dp_existing12345678')

      // Should return the existing plan, not the new one
      const loaded = repo.loadForDate(JOURNEY_ID, LOCAL_DATE)
      expect(loaded?.id).toBe('dp_existing12345678')
    })

    it('returns newer-schema if existing plan has future schema', async () => {
      const repo = createRepo()
      const futurePlan = createPlan()
      const futureSchemaPlan = { ...futurePlan, schemaVersion: 999 }
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(futureSchemaPlan))

      const newPlan = createPlan()
      const { result } = await repo.getOrCreate(JOURNEY_ID, LOCAL_DATE, newPlan)

      expect(result).toBe('newer-schema')
    })

    it('does not overwrite existing plan with new one', async () => {
      const repo = createRepo()
      const existingPlan = createPlan({ id: 'dp_existing12345678' })
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(existingPlan))

      const newPlan = createPlan({ id: 'dp_new9876543210' })
      await repo.getOrCreate(JOURNEY_ID, LOCAL_DATE, newPlan)

      // The stored plan should still be the original
      const stored = JSON.parse(window.localStorage.getItem(key)!)
      expect(stored.id).toBe('dp_existing12345678')
    })

    it('returns the persisted plan via read-after-write', async () => {
      const repo = createRepo()
      const plan = createPlan()

      const { result, plan: returnedPlan } = await repo.getOrCreate(JOURNEY_ID, LOCAL_DATE, plan)
      expect(result).toBe('ok')
      expect(returnedPlan).not.toBeNull()
      expect(returnedPlan?.id).toBe(plan.id)
      expect(returnedPlan?.journeyId).toBe(JOURNEY_ID)
      expect(returnedPlan?.localDate).toBe(LOCAL_DATE)
    })
  })

  describe('existsForDate', () => {
    it('returns false when no plan exists', () => {
      const repo = createRepo()
      expect(repo.existsForDate(JOURNEY_ID, LOCAL_DATE)).toBe(false)
    })

    it('returns true when plan exists', () => {
      const repo = createRepo()
      const plan = createPlan()
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(plan))

      expect(repo.existsForDate(JOURNEY_ID, LOCAL_DATE)).toBe(true)
    })

    it('returns false for future schema', () => {
      const repo = createRepo()
      const plan = createPlan()
      const futurePlan = { ...plan, schemaVersion: 999 }
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, JSON.stringify(futurePlan))

      expect(repo.existsForDate(JOURNEY_ID, LOCAL_DATE)).toBe(false)
    })

    it('returns false for corrupt data', () => {
      const repo = createRepo()
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      window.localStorage.setItem(key, 'not valid json')

      expect(repo.existsForDate(JOURNEY_ID, LOCAL_DATE)).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('returns true when storage is available', () => {
      const repo = createRepo()
      expect(repo.isAvailable()).toBe(true)
    })

    it('returns false when storage is null', () => {
      const repo = createDailyPlanRepository(createWebStorageStore(null))
      expect(repo.isAvailable()).toBe(false)
    })
  })
})
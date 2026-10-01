import { describe, expect, it } from 'vitest'

import {
  DAILY_PLAN_SCHEMA_VERSION,
  DAILY_PLAN_ID_PREFIX,
  createDailyPlanId,
  createDailyPlan,
  normalizeDailyPlan,
  hasNewerDailyPlanSchema,
  dailyPlanStorageKey,
} from '../domain/dailyPlan'
import { isValidLocalDate } from '../domain/localDate'

const NOW = '2026-10-01T09:00:00.000Z'
const JOURNEY_ID = 'jr_test1234567890'
const LOCAL_DATE = '2026-10-01'

describe('dailyPlan', () => {
  describe('createDailyPlanId', () => {
    it('generates ids with correct prefix', () => {
      const id = createDailyPlanId()
      expect(id.startsWith(DAILY_PLAN_ID_PREFIX)).toBe(true)
    })

    it('generates unique ids', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(createDailyPlanId())
      }
      expect(ids.size).toBe(100)
    })

    it('generates ids of consistent length', () => {
      const id = createDailyPlanId()
      // dp_ + 16 chars = 19 total
      expect(id.length).toBe(19)
    })
  })

  describe('createDailyPlan', () => {
    it('creates a plan with all required fields', () => {
      const planId = createDailyPlanId()
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, planId)

      expect(plan.schemaVersion).toBe(DAILY_PLAN_SCHEMA_VERSION)
      expect(plan.id).toBe(planId)
      expect(plan.journeyId).toBe(JOURNEY_ID)
      expect(plan.localDate).toBe(LOCAL_DATE)
      expect(plan.createdAt).toBe(NOW)
      expect(plan.updatedAt).toBe(NOW)
    })
  })

  describe('normalizeDailyPlan', () => {
    it('parses a valid plan', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const normalized = normalizeDailyPlan(plan, NOW)

      expect(normalized).not.toBeNull()
      expect(normalized?.id).toBe(plan.id)
      expect(normalized?.journeyId).toBe(JOURNEY_ID)
      expect(normalized?.localDate).toBe(LOCAL_DATE)
    })

    it('returns null for null/undefined', () => {
      expect(normalizeDailyPlan(null, NOW)).toBeNull()
      expect(normalizeDailyPlan(undefined, NOW)).toBeNull()
    })

    it('returns null for wrong schema version', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, schemaVersion: 999 }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('returns null for missing id', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, id: '' }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('returns null for wrong id prefix', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, id: 'wrong_prefix_123' }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('returns null for missing journeyId', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, journeyId: '' }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('returns null for invalid journeyId prefix', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, journeyId: 'wrong_journey' }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('returns null for invalid localDate', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, localDate: 'not-a-date' }
      expect(normalizeDailyPlan(badPlan, NOW)).toBeNull()
    })

    it('falls back to provided timestamp for missing timestamps', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const badPlan = { ...plan, createdAt: 'invalid', updatedAt: 'also-invalid' }
      const normalized = normalizeDailyPlan(badPlan, NOW)
      expect(normalized?.createdAt).toBe(NOW)
      expect(normalized?.updatedAt).toBe(NOW)
    })
  })

  describe('hasNewerDailyPlanSchema', () => {
    it('returns false for current schema', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      expect(hasNewerDailyPlanSchema(plan)).toBe(false)
    })

    it('returns true for newer schema', () => {
      const plan = createDailyPlan(JOURNEY_ID, LOCAL_DATE, NOW, createDailyPlanId())
      const newer = { ...plan, schemaVersion: DAILY_PLAN_SCHEMA_VERSION + 1 }
      expect(hasNewerDailyPlanSchema(newer)).toBe(true)
    })

    it('returns false for non-objects', () => {
      expect(hasNewerDailyPlanSchema(null)).toBe(false)
      expect(hasNewerDailyPlanSchema('string')).toBe(false)
      expect(hasNewerDailyPlanSchema(123)).toBe(false)
    })
  })

  describe('dailyPlanStorageKey', () => {
    it('creates correctly formatted keys', () => {
      const key = dailyPlanStorageKey(JOURNEY_ID, LOCAL_DATE)
      expect(key).toBe(`ascend:daily-plan:${JOURNEY_ID}:${LOCAL_DATE}`)
    })
  })

  describe('isValidLocalDate', () => {
    it('validates date format', () => {
      expect(isValidLocalDate('2026-10-01')).toBe(true)
      expect(isValidLocalDate('2026-01-01')).toBe(true)
      expect(isValidLocalDate('invalid')).toBe(false)
      expect(isValidLocalDate('2026/10/01')).toBe(false)
    })
  })
})
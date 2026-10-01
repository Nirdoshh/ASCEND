import { describe, expect, it } from 'vitest'

import {
  MAX_DAILY_STEP_LENGTH,
  DAILY_STEP_SCHEMA_VERSION,
  DAILY_STEP_ID_PREFIX,
  createDailyStepId,
  createDailyStep,
  updateDailyStep,
  validateDailyStepText,
  normalizeDailySteps,
  hasNewerDailyStepsSchema,
  dailyStepsStorageKey,
  normalizeDailyStepText,
  isDuplicateDailyStep,
  isAtMaxDailySteps,
  validateDailyStepCount,
} from '../domain/dailyStep'

const NOW = '2026-10-01T09:00:00.000Z'

describe('dailyStep domain', () => {
  describe('createDailyStepId', () => {
    it('generates ids with correct prefix', () => {
      const id = createDailyStepId()
      expect(id.startsWith(DAILY_STEP_ID_PREFIX)).toBe(true)
    })

    it('generates unique ids', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(createDailyStepId())
      }
      expect(ids.size).toBe(100)
    })

    it('generates ids of consistent length', () => {
      const id = createDailyStepId()
      // ds_ + 16 chars = 19 total
      expect(id.length).toBe(19)
    })
  })

  describe('createDailyStep', () => {
    it('creates a step with all required fields', () => {
      const stepId = createDailyStepId()
      const step = createDailyStep('Fix the onboarding routing bug', NOW, stepId)

      expect(step.schemaVersion).toBe(DAILY_STEP_SCHEMA_VERSION)
      expect(step.id).toBe(stepId)
      expect(step.text).toBe('Fix the onboarding routing bug')
    })

    it('trims outer whitespace while preserving internal whitespace and Unicode', () => {
      const step = createDailyStep('  Ship the ��� build — today  ', NOW, 'ds_unicode')
      expect(step.text).toBe('Ship the ��� build — today')
    })
  })

  describe('updateDailyStep', () => {
    it('updates text and preserves id', () => {
      const original = createDailyStep('Original step', NOW, 'ds_test1234567890')
      const updated = updateDailyStep(original, 'New step')

      expect(updated.id).toBe(original.id)
      expect(updated.text).toBe('New step')
    })

    it('trims edited text and preserves the stable id', () => {
      const original = createDailyStep('Original step', NOW, 'ds_test1234567890')
      const updated = updateDailyStep(original, '  Edited  step  ')
      expect(updated.id).toBe(original.id)
      expect(updated.text).toBe('Edited  step')
    })

    it('returns same step if text unchanged', () => {
      const original = createDailyStep('Same text', NOW, 'ds_test1234567890')
      const updated = updateDailyStep(original, 'Same text')

      expect(updated).toBe(original)
    })
  })

  describe('validateDailyStepText', () => {
    it('accepts valid text', () => {
      expect(validateDailyStepText('Fix the onboarding routing bug')).toEqual({ ok: true })
      expect(validateDailyStepText('Test the full onboarding flow')).toEqual({ ok: true })
      expect(validateDailyStepText('Deploy the verified build')).toEqual({ ok: true })
      expect(validateDailyStepText('Put on running clothes after breakfast')).toEqual({ ok: true })
      expect(validateDailyStepText('Call three potential customers')).toEqual({ ok: true })
    })

    it('rejects blank text', () => {
      expect(validateDailyStepText('')).toEqual({
        ok: false,
        message: 'Type what you\'ll do.',
      })
    })

    it('rejects whitespace-only text', () => {
      expect(validateDailyStepText('   ')).toEqual({
        ok: false,
        message: 'Type what you\'ll do.',
      })
    })

    it('rejects text over max length', () => {
      const longText = 'a'.repeat(MAX_DAILY_STEP_LENGTH + 1)
      expect(validateDailyStepText(longText)).toEqual({
        ok: false,
        message: `Keep it to ${MAX_DAILY_STEP_LENGTH} characters or fewer.`,
      })
    })

    it('accepts text at max length', () => {
      const maxText = 'a'.repeat(MAX_DAILY_STEP_LENGTH)
      expect(validateDailyStepText(maxText)).toEqual({ ok: true })
    })

    it('preserves internal spaces and punctuation', () => {
      expect(validateDailyStepText('Call three potential customers, and schedule follow-ups.')).toEqual({ ok: true })
    })
  })

  describe('normalizeDailyStepText', () => {
    it('normalizes text for comparison', () => {
      expect(normalizeDailyStepText('Call three customers')).toBe('call three customers')
      expect(normalizeDailyStepText('  call three customers  ')).toBe('call three customers')
      expect(normalizeDailyStepText('CALL THREE CUSTOMERS')).toBe('call three customers')
    })
  })

  describe('normalizeDailySteps', () => {
    it('rejects duplicate ids and duplicate normalized text', () => {
      const first = createDailyStep('Call customers', NOW, 'ds_one')
      expect(normalizeDailySteps([first, { ...first, text: 'Another action' }])).toBeNull()
      expect(normalizeDailySteps([first, { ...first, id: 'ds_two', text: '  CALL CUSTOMERS  ' }])).toBeNull()
    })

    it('normalizes persisted text without truncating meaningful content', () => {
      const raw = [{ schemaVersion: 1, id: 'ds_one', text: '  Use emoji ��� and punctuation!  ' }]
      expect(normalizeDailySteps(raw)).toEqual([
        { schemaVersion: 1, id: 'ds_one', text: 'Use emoji ��� and punctuation!' },
      ])
    })

    it('rejects blank and over-length persisted text', () => {
      expect(normalizeDailySteps([{ schemaVersion: 1, id: 'ds_one', text: '   ' }])).toBeNull()
      expect(normalizeDailySteps([{ schemaVersion: 1, id: 'ds_one', text: 'a'.repeat(MAX_DAILY_STEP_LENGTH + 1) }])).toBeNull()
    })
  })

  describe('hasNewerDailyStepsSchema', () => {
    it('detects a future schema without adopting it', () => {
      const step = createDailyStep('Future action', NOW, 'ds_future')
      expect(hasNewerDailyStepsSchema([{ ...step, schemaVersion: 2 }])).toBe(true)
      expect(hasNewerDailyStepsSchema([step])).toBe(false)
      expect(hasNewerDailyStepsSchema(null)).toBe(false)
    })
  })

  describe('isDuplicateDailyStep', () => {
    it('detects duplicate text', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Call three customers' },
      ] as any
      expect(isDuplicateDailyStep(steps, ' call three customers ')).toBe(true)
      expect(isDuplicateDailyStep(steps, 'CALL THREE CUSTOMERS')).toBe(true)
    })

    it('returns false for different text', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Call three customers' },
      ] as any
      expect(isDuplicateDailyStep(steps, 'Deploy the auth flow')).toBe(false)
    })

    it('allows the current step to retain its own text during editing', () => {
      const steps = [{ schemaVersion: 1, id: 'ds_1', text: 'Call three customers' }] as any
      expect(isDuplicateDailyStep(steps, 'Call three customers', 'ds_1')).toBe(false)
    })
  })

  describe('isAtMaxDailySteps', () => {
    it('returns false for fewer than 4 steps', () => {
      expect(isAtMaxDailySteps([])).toBe(false)
      expect(isAtMaxDailySteps([{ schemaVersion: 1, id: 'ds_1', text: 'Step 1' }] as any)).toBe(false)
      expect(isAtMaxDailySteps([
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
        { schemaVersion: 1, id: 'ds_3', text: 'Step 3' },
      ] as any)).toBe(false)
    })

    it('returns true for 4 steps', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
        { schemaVersion: 1, id: 'ds_3', text: 'Step 3' },
        { schemaVersion: 1, id: 'ds_4', text: 'Step 4' },
      ] as any
      expect(isAtMaxDailySteps(steps)).toBe(true)
    })
  })

  describe('validateDailyStepCount', () => {
    it('rejects 0 steps as incomplete', () => {
      expect(validateDailyStepCount([])).toEqual({
        ok: false,
        message: 'Add at least 2 small actions that move today\'s Win forward.',
        state: 'incomplete',
      })
    })

    it('rejects 1 step as incomplete', () => {
      const steps = [{ schemaVersion: 1, id: 'ds_1', text: 'Step 1' }] as any
      expect(validateDailyStepCount(steps)).toEqual({
        ok: false,
        message: 'Add at least one more step to reach the minimum of 2.',
        state: 'incomplete',
      })
    })

    it('accepts 2 steps as valid', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
      ] as any
      expect(validateDailyStepCount(steps)).toEqual({ ok: true, message: '', state: 'valid' })
    })

    it('accepts 3 steps as valid', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
        { schemaVersion: 1, id: 'ds_3', text: 'Step 3' },
      ] as any
      expect(validateDailyStepCount(steps)).toEqual({ ok: true, message: '', state: 'valid' })
    })

    it('accepts 4 steps as valid', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
        { schemaVersion: 1, id: 'ds_3', text: 'Step 3' },
        { schemaVersion: 1, id: 'ds_4', text: 'Step 4' },
      ] as any
      expect(validateDailyStepCount(steps)).toEqual({ ok: true, message: '', state: 'valid' })
    })

    it('rejects 5 steps as too many', () => {
      const steps = [
        { schemaVersion: 1, id: 'ds_1', text: 'Step 1' },
        { schemaVersion: 1, id: 'ds_2', text: 'Step 2' },
        { schemaVersion: 1, id: 'ds_3', text: 'Step 3' },
        { schemaVersion: 1, id: 'ds_4', text: 'Step 4' },
        { schemaVersion: 1, id: 'ds_5', text: 'Step 5' },
      ] as any
      expect(validateDailyStepCount(steps)).toEqual({
        ok: false,
        message: 'Keep it to 4 steps or fewer. You have 5.',
        state: 'too-many',
      })
    })
  })

  describe('dailyStepsStorageKey', () => {
    it('creates correctly formatted keys', () => {
      const key = dailyStepsStorageKey('dp_test1234567890')
      expect(key).toBe('ascend:daily-steps:dp_test1234567890')
    })
  })

  describe('normalizeDailyStepText', () => {
    it('normalizes text for comparison', () => {
      expect(normalizeDailyStepText('Call three customers')).toBe('call three customers')
      expect(normalizeDailyStepText('  call three customers  ')).toBe('call three customers')
      expect(normalizeDailyStepText('CALL THREE CUSTOMERS')).toBe('call three customers')
    })
  })
})

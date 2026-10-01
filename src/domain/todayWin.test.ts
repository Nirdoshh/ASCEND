import { describe, expect, it } from 'vitest'

import {
  MAX_TODAY_WIN_LENGTH,
  TODAY_WIN_SCHEMA_VERSION,
  TODAY_WIN_ID_PREFIX,
  createTodayWinId,
  createTodayWin,
  updateTodayWin,
  validateTodayWinText,
  normalizeTodayWin,
  hasNewerTodayWinSchema,
  todayWinStorageKey,
} from './todayWin'

const NOW = '2026-10-01T09:00:00.000Z'
const DAILY_PLAN_ID = 'dp_test1234567890'

describe('todayWin domain', () => {
  describe('createTodayWinId', () => {
    it('generates ids with correct prefix', () => {
      const id = createTodayWinId()
      expect(id.startsWith(TODAY_WIN_ID_PREFIX)).toBe(true)
    })

    it('generates unique ids', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(createTodayWinId())
      }
      expect(ids.size).toBe(100)
    })

    it('generates ids of consistent length', () => {
      const id = createTodayWinId()
      expect(id.length).toBe(19)
    })
  })

  describe('createTodayWin', () => {
    it('creates a win with all required fields', () => {
      const winId = createTodayWinId()
      const win = createTodayWin(DAILY_PLAN_ID, 'Deploy the auth flow', NOW, winId)

      expect(win.schemaVersion).toBe(TODAY_WIN_SCHEMA_VERSION)
      expect(win.id).toBe(winId)
      expect(win.dailyPlanId).toBe(DAILY_PLAN_ID)
      expect(win.text).toBe('Deploy the auth flow')
      expect(win.createdAt).toBe(NOW)
      expect(win.updatedAt).toBe(NOW)
    })

    it('preserves the text exactly as provided', () => {
      const text = '  Finish chapter 3  '
      const win = createTodayWin(DAILY_PLAN_ID, text, NOW, createTodayWinId())
      expect(win.text).toBe(text)
    })
  })

  describe('updateTodayWin', () => {
    it('updates text and timestamp, preserves id', () => {
      const original = createTodayWin(DAILY_PLAN_ID, 'Original win', NOW, 'tw_test1234567890')
      const updated = updateTodayWin(original, 'New win', '2026-10-01T10:00:00.000Z')

      expect(updated.id).toBe(original.id)
      expect(updated.dailyPlanId).toBe(original.dailyPlanId)
      expect(updated.text).toBe('New win')
      expect(updated.createdAt).toBe(original.createdAt)
      expect(updated.updatedAt).toBe('2026-10-01T10:00:00.000Z')
    })

    it('returns same win if text unchanged', () => {
      const original = createTodayWin(DAILY_PLAN_ID, 'Same text', NOW, 'tw_test1234567890')
      const updated = updateTodayWin(original, 'Same text', '2026-10-01T10:00:00.000Z')
      expect(updated).toBe(original)
    })
  })

  describe('validateTodayWinText', () => {
    it('accepts valid text', () => {
      expect(validateTodayWinText('Deploy the auth flow')).toEqual({ ok: true })
      expect(validateTodayWinText('Finish chapter 3 and solve the practice problems')).toEqual({ ok: true })
      expect(validateTodayWinText('Run 5 km')).toEqual({ ok: true })
      expect(validateTodayWinText('Call three potential customers')).toEqual({ ok: true })
      expect(validateTodayWinText('Record and publish my first short video')).toEqual({ ok: true })
    })

    it('rejects blank text', () => {
      expect(validateTodayWinText('')).toEqual({
        ok: false,
        message: 'Type what would make today a win.',
      })
    })

    it('rejects whitespace-only text', () => {
      expect(validateTodayWinText('   ')).toEqual({
        ok: false,
        message: 'Type what would make today a win.',
      })
    })

    it('rejects text over max length', () => {
      const longText = 'a'.repeat(MAX_TODAY_WIN_LENGTH + 1)
      expect(validateTodayWinText(longText)).toEqual({
        ok: false,
        message: `Keep it to ${MAX_TODAY_WIN_LENGTH} characters or fewer.`,
      })
    })

    it('accepts text at max length', () => {
      const maxText = 'a'.repeat(MAX_TODAY_WIN_LENGTH)
      expect(validateTodayWinText(maxText)).toEqual({ ok: true })
    })

    it('preserves internal spaces and punctuation', () => {
      expect(validateTodayWinText('Call three potential customers, and schedule follow-ups.')).toEqual({ ok: true })
    })
  })

  describe('normalizeTodayWin', () => {
    it('parses a valid win', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Deploy the auth flow', NOW, createTodayWinId())
      const normalized = normalizeTodayWin(win, NOW)

      expect(normalized).not.toBeNull()
      expect(normalized?.id).toBe(win.id)
      expect(normalized?.dailyPlanId).toBe(DAILY_PLAN_ID)
      expect(normalized?.text).toBe('Deploy the auth flow')
    })

    it('returns null for null/undefined', () => {
      expect(normalizeTodayWin(null, NOW)).toBeNull()
      expect(normalizeTodayWin(undefined, NOW)).toBeNull()
    })

    it('returns null for wrong schema version', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, schemaVersion: 999 }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('returns null for missing id', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, id: '' }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('returns null for wrong id prefix', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, id: 'wrong_prefix_123' }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('returns null for missing dailyPlanId', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, dailyPlanId: '' }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('returns null for wrong dailyPlanId prefix', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, dailyPlanId: 'wrong_plan' }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('returns null for missing text', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, text: '' }
      expect(normalizeTodayWin(badWin, NOW)).toBeNull()
    })

    it('falls back to provided timestamp for missing timestamps', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const badWin = { ...win, createdAt: 'invalid', updatedAt: 'also-invalid' }
      const normalized = normalizeTodayWin(badWin, NOW)
      expect(normalized?.createdAt).toBe(NOW)
      expect(normalized?.updatedAt).toBe(NOW)
    })
  })

  describe('hasNewerTodayWinSchema', () => {
    it('returns false for current schema', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      expect(hasNewerTodayWinSchema(win)).toBe(false)
    })

    it('returns true for newer schema', () => {
      const win = createTodayWin(DAILY_PLAN_ID, 'Test', NOW, createTodayWinId())
      const newer = { ...win, schemaVersion: TODAY_WIN_SCHEMA_VERSION + 1 }
      expect(hasNewerTodayWinSchema(newer)).toBe(true)
    })

    it('returns false for non-objects', () => {
      expect(hasNewerTodayWinSchema(null)).toBe(false)
      expect(hasNewerTodayWinSchema('string')).toBe(false)
      expect(hasNewerTodayWinSchema(123)).toBe(false)
    })
  })

  describe('todayWinStorageKey', () => {
    it('creates correctly formatted keys', () => {
      const key = todayWinStorageKey('dp_test1234567890')
      expect(key).toBe('ascend:today-win:dp_test1234567890')
    })
  })
})
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { createTodayWinRepository } from './todayWinRepository'
import { createWebStorageStore } from '../storage'
import { createTodayWin, createTodayWinId } from '../../domain/todayWin'
import { todayWinStorageKey } from '../../domain/todayWin'

const NOW = '2026-10-01T09:00:00.000Z'
const DAILY_PLAN_ID = 'dp_test1234567890'

function createRepo() {
  return createTodayWinRepository(createWebStorageStore())
}

function createWin(overrides: Partial<{ dailyPlanId: string; text: string; id: string }> = {}) {
  return createTodayWin(
    overrides.dailyPlanId ?? DAILY_PLAN_ID,
    overrides.text ?? 'Deploy the auth flow',
    NOW,
    overrides.id ?? createTodayWinId(),
  )
}

describe('todayWinRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadForPlan', () => {
    it('returns null when no win exists', () => {
      const repo = createRepo()
      const win = repo.loadForPlan(DAILY_PLAN_ID)
      expect(win).toBeNull()
    })

    it('loads an existing win', () => {
      const repo = createRepo()
      const win = createWin()
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(win))

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(win.id)
      expect(loaded?.dailyPlanId).toBe(DAILY_PLAN_ID)
      expect(loaded?.text).toBe('Deploy the auth flow')
    })

    it('returns null for future schema', () => {
      const repo = createRepo()
      const win = createWin()
      const futureWin = { ...win, schemaVersion: 999 }
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureWin))

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).toBeNull()
    })

    it('returns null for corrupt data', () => {
      const repo = createRepo()
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, 'not valid json')

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).toBeNull()
    })

    it('returns null for wrong daily plan', () => {
      const repo = createRepo()
      const win = createWin()
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(win))

      const loaded = repo.loadForPlan('different_plan')
      expect(loaded).toBeNull()
    })
  })

  describe('save', () => {
    it('creates a new win when none exists', () => {
      const repo = createRepo()
      const win = createWin()

      const result = repo.save(win)
      expect(result).toBe('ok')

      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(win.id)
    })

    it('returns existing win when one exists', () => {
      const repo = createRepo()
      const existingWin = createWin({ id: 'tw_existing12345678' })
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(existingWin))

      const newWin = createWin({ id: 'tw_new9876543210' })
      const result = repo.save(newWin)

      expect(result).toBe('ok')

      // Should return the existing win, not the new one
      const loaded = repo.loadForPlan(DAILY_PLAN_ID)
      expect(loaded?.id).toBe('tw_existing12345678')
    })

    it('returns newer-schema if existing win has future schema', () => {
      const repo = createRepo()
      const futureWin = createWin()
      const futureSchemaWin = { ...futureWin, schemaVersion: 999 }
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureSchemaWin))

      const newWin = createWin()
      const result = repo.save(newWin)

      expect(result).toBe('newer-schema')
    })

    it('does not overwrite existing win with new one', () => {
      const repo = createRepo()
      const existingWin = createWin({ id: 'tw_existing12345678' })
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(existingWin))

      const newWin = createWin({ id: 'tw_new9876543210' })
      repo.save(newWin)

      // The stored win should still be the original
      const stored = JSON.parse(window.localStorage.getItem(key)!)
      expect(stored.id).toBe('tw_existing12345678')
    })
  })

  describe('existsForPlan', () => {
    it('returns false when no win exists', () => {
      const repo = createRepo()
      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(false)
    })

    it('returns true when win exists', () => {
      const repo = createRepo()
      const win = createWin()
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(win))

      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(true)
    })

    it('returns false for future schema', () => {
      const repo = createRepo()
      const win = createWin()
      const futureWin = { ...win, schemaVersion: 999 }
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, JSON.stringify(futureWin))

      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(false)
    })

    it('returns false for corrupt data', () => {
      const repo = createRepo()
      const key = todayWinStorageKey(DAILY_PLAN_ID)
      window.localStorage.setItem(key, 'not valid json')

      expect(repo.existsForPlan(DAILY_PLAN_ID)).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('returns true when storage is available', () => {
      const repo = createRepo()
      expect(repo.isAvailable()).toBe(true)
    })

    it('returns false when storage is null', () => {
      const repo = createTodayWinRepository(createWebStorageStore(null))
      expect(repo.isAvailable()).toBe(false)
    })
  })
})
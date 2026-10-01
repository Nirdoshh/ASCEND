import { describe, expect, it } from 'vitest'

import {
  isValidLocalDate,
  parseLocalDate,
  createLocalDate,
  compareLocalDate,
  isSameLocalDate,
  createSystemLocalDateProvider,
  createFixedLocalDateProvider,
} from '../domain/localDate'

describe('localDate', () => {
  describe('isValidLocalDate', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
      expect(isValidLocalDate('2026-10-01')).toBe(true)
      expect(isValidLocalDate('2026-01-01')).toBe(true)
      expect(isValidLocalDate('2026-12-31')).toBe(true)
    })

    it('rejects invalid formats', () => {
      expect(isValidLocalDate('2026/10/01')).toBe(false)
      expect(isValidLocalDate('01-10-2026')).toBe(false)
      expect(isValidLocalDate('2026-1-1')).toBe(false)
      expect(isValidLocalDate('2026-13-01')).toBe(false)
      expect(isValidLocalDate('2026-00-01')).toBe(false)
      expect(isValidLocalDate('2026-01-00')).toBe(false)
      expect(isValidLocalDate('not-a-date')).toBe(false)
      expect(isValidLocalDate('')).toBe(false)
      expect(isValidLocalDate(null)).toBe(false)
      expect(isValidLocalDate(123)).toBe(false)
    })

    it('rejects invalid calendar dates', () => {
      expect(isValidLocalDate('2026-02-30')).toBe(false)
      expect(isValidLocalDate('2026-04-31')).toBe(false)
      expect(isValidLocalDate('2025-02-29')).toBe(false) // 2025 not a leap year
    })

    it('accepts leap day on leap years', () => {
      expect(isValidLocalDate('2024-02-29')).toBe(true)
      expect(isValidLocalDate('2020-02-29')).toBe(true)
    })
  })

  describe('parseLocalDate', () => {
    it('parses valid dates into components', () => {
      expect(parseLocalDate('2026-10-01')).toEqual({ year: 2026, month: 10, day: 1 })
      expect(parseLocalDate('2026-01-01')).toEqual({ year: 2026, month: 1, day: 1 })
      expect(parseLocalDate('2026-12-31')).toEqual({ year: 2026, month: 12, day: 31 })
    })

    it('returns null for invalid dates', () => {
      expect(parseLocalDate('invalid')).toBeNull()
      expect(parseLocalDate('2026/10/01')).toBeNull()
    })
  })

  describe('createLocalDate', () => {
    it('creates properly formatted dates', () => {
      expect(createLocalDate(2026, 10, 1)).toBe('2026-10-01')
      expect(createLocalDate(2026, 1, 1)).toBe('2026-01-01')
      expect(createLocalDate(2026, 12, 31)).toBe('2026-12-31')
    })
  })

  describe('compareLocalDate', () => {
    it('orders dates correctly', () => {
      expect(compareLocalDate('2026-01-01', '2026-10-01')).toBe(-1)
      expect(compareLocalDate('2026-10-01', '2026-01-01')).toBe(1)
      expect(compareLocalDate('2026-10-01', '2026-10-01')).toBe(0)
    })
  })

  describe('isSameLocalDate', () => {
    it('returns true for same dates', () => {
      expect(isSameLocalDate('2026-10-01', '2026-10-01')).toBe(true)
    })

    it('returns false for different dates', () => {
      expect(isSameLocalDate('2026-10-01', '2026-10-02')).toBe(false)
    })
  })

  describe('createFixedLocalDateProvider', () => {
    it('returns the fixed date', () => {
      const provider = createFixedLocalDateProvider('2026-10-01')
      expect(provider.today()).toBe('2026-10-01')
    })
  })

  describe('createSystemLocalDateProvider', () => {
    it('returns a valid local date', () => {
      const provider = createSystemLocalDateProvider()
      const today = provider.today()
      expect(isValidLocalDate(today)).toBe(true)
    })
  })
})
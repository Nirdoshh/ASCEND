import { describe, expect, it } from 'vitest'
import { addLocalDays, isValidLocalDate, localDateFromTimestamp, localDaysBetween } from './localDate'

describe('local calendar arithmetic for Progress', () => {
  it.each([
    ['2026-10-01T23:30:00Z', 'Asia/Katmandu', '2026-10-02'],
    ['2026-10-02T01:00:00Z', 'America/Los_Angeles', '2026-10-01'],
    ['2026-10-01T18:14:59Z', 'Asia/Katmandu', '2026-10-01'],
    ['2026-10-01T18:15:00Z', 'Asia/Katmandu', '2026-10-02'],
  ])('converts %s in %s to %s', (timestamp, zone, expected) => {
    expect(localDateFromTimestamp(timestamp, zone)).toBe(expected)
  })

  it('counts calendar boundaries over spring and autumn DST changes', () => {
    expect(localDaysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(localDaysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('moves across year, month and leap-day boundaries', () => {
    expect(addLocalDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addLocalDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles years below 100 without the Date.UTC 1900 offset', () => {
    expect(isValidLocalDate('0099-12-31')).toBe(true)
    expect(addLocalDays('0099-12-31', 1)).toBe('0100-01-01')
  })

  it('rejects impossible calendar dates rather than rolling them forward', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false)
    expect(() => addLocalDays('2026-02-30', 1)).toThrow(RangeError)
  })
})

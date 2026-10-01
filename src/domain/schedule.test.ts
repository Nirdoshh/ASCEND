import { describe, expect, it } from 'vitest'

import {
  boundedNumberToText,
  DAILY_EFFORT_BOUNDS,
  DURATION_BOUNDS,
  isBoundedNumberInRange,
  isPositiveWholeNumber,
  normalizeStoredCount,
  parseNumberChoice,
} from './schedule'

/**
 * The two numeric answers, tested as one mechanism.
 *
 * Duration and Daily Effort share every rule and differ only in their bounds,
 * their presets and the word used in a message. The tests below are therefore
 * written once against the shared rule and run against both bound sets where
 * the difference could matter, rather than duplicated per screen.
 */

const DAYS = DURATION_BOUNDS
const MINUTES = DAILY_EFFORT_BOUNDS

/** Narrows to the failure branch so a test can read which problem it was. */
function refusal(raw: string, bounds: { min: number; max: number; unit: string }) {
  const result = parseNumberChoice(raw, bounds)
  if (result.ok) throw new Error(`expected ${raw} to be refused`)
  return result
}

function accepted(raw: string, bounds: { min: number; max: number; unit: string }): number {
  const result = parseNumberChoice(raw, bounds)
  if (!result.ok) throw new Error(`expected ${raw} to be accepted: ${result.message}`)
  return result.value
}

describe('parseNumberChoice — the presets', () => {
  it('accepts every duration preset', () => {
    for (const days of [21, 30, 45, 60, 90]) {
      expect(accepted(String(days), DAYS), String(days)).toBe(days)
    }
  })

  it('accepts every daily effort preset', () => {
    for (const minutes of [10, 20, 30, 45, 60, 90]) {
      expect(accepted(String(minutes), MINUTES), String(minutes)).toBe(minutes)
    }
  })
})

describe('parseNumberChoice — the bounds', () => {
  it('accepts exactly the minimum and exactly the maximum duration', () => {
    expect(accepted('7', DAYS)).toBe(7)
    expect(accepted('365', DAYS)).toBe(365)
  })

  it('refuses one below the minimum and one above the maximum', () => {
    expect(refusal('6', DAYS).problem).toBe('out-of-range')
    expect(refusal('366', DAYS).problem).toBe('out-of-range')
  })

  it('accepts exactly the minimum and exactly the maximum effort', () => {
    expect(accepted('5', MINUTES)).toBe(5)
    expect(accepted('480', MINUTES)).toBe(480)
  })

  it('refuses one below the minimum and one above the maximum effort', () => {
    expect(refusal('4', MINUTES).problem).toBe('out-of-range')
    expect(refusal('481', MINUTES).problem).toBe('out-of-range')
  })

  it('names the real range, built from the same constants the rule uses', () => {
    // The message cannot go stale if a bound moves, because it is not typed
    // out anywhere: it is interpolated from the bounds object.
    expect(refusal('6', DAYS).message).toBe('Choose between 7 and 365 days.')
    expect(refusal('481', MINUTES).message).toBe('Choose between 5 and 480 minutes.')
  })

  it('refuses a custom answer of 0 as OUT OF RANGE, not as unanswered', () => {
    // The distinction matters. "Type how many days you want" would be a lie
    // for somebody who typed a 0 — they typed something, and it is not a
    // duration. Zero is the whole reason this file exists.
    expect(refusal('0', DAYS).problem).toBe('out-of-range')
    expect(refusal('0', MINUTES).problem).toBe('out-of-range')
  })

  it('refuses a negative answer as out of range rather than unreadable', () => {
    expect(refusal('-5', DAYS).problem).toBe('out-of-range')
    expect(refusal('-1', MINUTES).problem).toBe('out-of-range')
  })
})

describe('parseNumberChoice — absence and unreadable input', () => {
  it('treats an empty box as unanswered rather than as zero', () => {
    expect(refusal('', DAYS).problem).toBe('empty')
    expect(refusal('', DAYS).message).toBe('Type how many days you want.')
  })

  it('treats whitespace exactly as it treats an empty box', () => {
    expect(refusal('   ', DAYS).problem).toBe('empty')
    expect(refusal('\t\n', MINUTES).problem).toBe('empty')
  })

  it('trims around a real number rather than refusing it', () => {
    expect(accepted('  30  ', DAYS)).toBe(30)
  })

  it('refuses a word rather than guessing at it', () => {
    expect(refusal('thirty', DAYS).problem).toBe('not-a-number')
    expect(refusal('twelve', MINUTES).problem).toBe('not-a-number')
  })

  it('refuses a fraction rather than rounding it', () => {
    // 30.5 is a whole number of days away from being 31, and silently
    // storing 31 would mean the stored answer is not the answer given.
    expect(refusal('30.5', DAYS).problem).toBe('not-a-number')
    expect(refusal('0.5', MINUTES).problem).toBe('not-a-number')
  })

  it('refuses a unit typed into the box rather than reading the number out of it', () => {
    // parseInt("30 days") is 30. Number("30 days") is NaN. The second is
    // correct: the user typed something that is not a number.
    expect(refusal('30 days', DAYS).problem).toBe('not-a-number')
    expect(refusal('30 minutes', MINUTES).problem).toBe('not-a-number')
  })

  it('refuses hexadecimal, binary and exponent forms rather than reading a number out of them', () => {
    // Number("0x1E") is 30 and Number("1e2") is 100. Both would store a
    // number the user never typed, which is exactly the bug this phase is
    // written to avoid. They are refused instead.
    expect(refusal('0x1E', DAYS).problem).toBe('not-a-number')
    expect(refusal('1e2', DAYS).problem).toBe('not-a-number')
    expect(refusal('0b11111', DAYS).problem).toBe('not-a-number')
    expect(refusal('0o36', DAYS).problem).toBe('not-a-number')
  })

  it('accepts a leading plus, because it is still a whole number', () => {
    expect(accepted('+30', DAYS)).toBe(30)
  })

  it('refuses a number written in another script rather than misreading it', () => {
    // A pinned limitation, not a feature. `\d` is ASCII-only, so these are
    // refused as unreadable. The alternative — guessing at a script's numeric
    // system — is a worse failure than saying plainly that we could not read
    // it, and the message it produces is honest.
    expect(refusal('٣٠', DAYS).problem).toBe('not-a-number')
    expect(refusal('३०', DAYS).problem).toBe('not-a-number')
  })

  it('refuses a digit string too long to be a real answer', () => {
    // Number("9".repeat(400)) is Infinity. Infinity is not a whole number
    // anybody typed, and comparing it with the maximum would silently refuse
    // it as out of range instead of unreadable.
    expect(refusal('9'.repeat(400), DAYS).problem).toBe('not-a-number')
  })
})

describe('isPositiveWholeNumber', () => {
  it('accepts one and above', () => {
    expect(isPositiveWholeNumber(1)).toBe(true)
    expect(isPositiveWholeNumber(30)).toBe(true)
    expect(isPositiveWholeNumber(Number.MAX_SAFE_INTEGER)).toBe(true)
  })

  it('refuses zero, negatives, fractions and the non-finite values', () => {
    for (const value of [0, -1, -0, 1.5, NaN, Infinity, -Infinity]) {
      expect(isPositiveWholeNumber(value), String(value)).toBe(false)
    }
  })

  it('refuses everything that is not a number at all', () => {
    for (const value of ['30', null, undefined, true, {}, []]) {
      expect(isPositiveWholeNumber(value), String(value)).toBe(false)
    }
  })
})

describe('normalizeStoredCount', () => {
  it('keeps a positive whole number, including one outside this build’s bounds', () => {
    // 500 days cannot come from our own screens. It can only be hand-edited
    // storage or a draft written with different bounds, and in both cases the
    // honest reading is "somebody gave us this number": it is kept, and the
    // step validator refuses the step with a message they can act on.
    expect(normalizeStoredCount(30)).toBe(30)
    expect(normalizeStoredCount(500)).toBe(500)
    expect(normalizeStoredCount(1)).toBe(1)
  })

  it('drops zero, negatives, fractions and junk rather than repairing them', () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, '30', null, undefined, {}]) {
      expect(normalizeStoredCount(value), String(value)).toBeNull()
    }
  })
})

describe('isBoundedNumberInRange', () => {
  it('is true only inside the range', () => {
    expect(isBoundedNumberInRange(7, DAYS)).toBe(true)
    expect(isBoundedNumberInRange(365, DAYS)).toBe(true)
    expect(isBoundedNumberInRange(6, DAYS)).toBe(false)
    expect(isBoundedNumberInRange(366, DAYS)).toBe(false)
  })

  it('is false for absent, zero and fractions', () => {
    expect(isBoundedNumberInRange(undefined, DAYS)).toBe(false)
    expect(isBoundedNumberInRange(0, DAYS)).toBe(false)
    expect(isBoundedNumberInRange(30.5, DAYS)).toBe(false)
  })
})

describe('boundedNumberToText', () => {
  it('renders an absent answer as an empty box, never as a default', () => {
    expect(boundedNumberToText(undefined)).toBe('')
  })

  it('renders a stored number as itself', () => {
    expect(boundedNumberToText(30)).toBe('30')
    expect(boundedNumberToText(500)).toBe('500')
  })
})

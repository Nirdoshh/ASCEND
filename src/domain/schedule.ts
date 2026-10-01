/**
 * The two numeric answers: how long, and how much each day.
 *
 * WHY DURATION AND DAILY EFFORT SHARE A FILE
 *
 * They are two facets of one question — "how will you work on this?" — and
 * mechanically they are the same kind of answer:
 *
 *   a set of presets, plus an optional typed value, stored as a whole
 *   number, ABSENT until answered, never zero, and refused when it falls
 *   outside a range.
 *
 * `validateBoundedChoice` is the shared rule and the two exports are the
 * parameters: the bounds, the presets, and the words. That is exactly the
 * split `validateAnswer` already makes for the Goal and the WHY in
 * onboardingValidation.ts, and it is taken for the same reason — two
 * hand-written copies of "absent, or a whole number in range" is how the
 * effort screen ends up accepting zero because the duration screen did not.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   An answer is ABSENT or it is a WHOLE NUMBER IN RANGE. There is no
 *   third state, and in particular there is no zero.
 *
 * `durationDays: 0` and `dailyEffortMinutes: 0` are the worst values this
 * codebase could store. They are not "a short duration" and "no effort" —
 * they are arithmetic that has to be defended against everywhere
 * downstream: divide by it, compare with `<`, render a progress bar whose
 * width is a division by zero. And they are trivially reachable, because a
 * number input starts at 0 and an empty box parses to 0.
 *
 * So the representation is made unrepresentable instead of defended
 * against. There is no constructor that can produce a 0, and
 * `normalizeBoundedChoice` at the read boundary drops one rather than
 * repairing it — the same rule personalAnswer.ts applies to a blank Goal:
 * "not answered" is what a user who typed nothing meant, and storing
 * something else on their behalf is a guess.
 *
 * WHY NOT DATES
 *
 * Duration is a COUNT OF DAYS, never a pair of calendar dates. The brief
 * says not to use dates yet, and the reasoning holds: the start date
 * depends on when they press the button, which means a draft written on
 * Sunday and one written on Monday would be genuinely different answers
 * that are really the same answer. That belongs in Phase 2D, where the
 * Journey is created and the start date actually exists. Here it would be
 * a field that changes meaning on every page load.
 *
 * WHY THE BOUNDS ARE 7–365 AND 5–480
 *
 * DURATION, 7 to 365 days.
 *
 *   7 is roughly "one week", the shortest span in which "prove you're making
 *   progress" can be answered honestly. Under it, the milestones cannot
 *   all happen and the Journey is a schedule that fails on arrival.
 *
 *   365 is "about a year" — a year, give or take a fortnight. It is
 *   deliberately not "no maximum": a milestone list is designed to be
 *   re-read on a bad day, and a 1,000-day plan is a plan nobody re-reads.
 *   An unbounded field is also an unbounded number of later screens.
 *
 * DAILY EFFORT, 5 to 480 minutes.
 *
 *   5 minutes is genuinely all some people have, and "realistically" is the
 *   word in the question. A floor that excluded 5 minutes would exclude
 *   exactly the person being most honest, which is the opposite of what the
 *   brief is asking for.
 *
 *   480 is eight hours: a full working day, which is the point where a
 *     "daily effort" has stopped being an effort budget and become an
 *     hours-at-work form.
 *
 * The brief proposed these exact numbers, and there is no product reason
 * here to move them. If a number changes it changes in this file, and the
 * message that mentions it is built from the same constant, so the text
 * cannot go stale.
 *
 * NOTHING HERE IS A SCORE
 *
 * Neither number produces a difficulty level, a rating, or any kind of
 * points, and neither is compared against the other. Choosing 90 days and
 * 10 minutes a day is not a "bigger" or "harder" Journey than 30 days and
 * 90 minutes — it is a different shape of commitment, which is the entire
 * point of asking both questions. These are planning context. See the brief.
 */

/** Shortest Journey a milestone list can honestly be measured against. */
export const MIN_DURATION_DAYS = 7

/** About a year. Long enough to be generous, short enough to be re-read. */
export const MAX_DURATION_DAYS = 365

/** Shortest daily commitment that is not zero, rounded to something real. */
export const MIN_DAILY_EFFORT_MINUTES = 5

/** A full working day. Beyond this, "daily effort" is an hours-at-work form. */
export const MAX_DAILY_EFFORT_MINUTES = 480

/**
 * The offered durations, in days.
 *
 * Hand-written rather than generated from the bounds, because the SET is a
 * product decision. 21 and 45 are the odd ones out on purpose: 30, 60 and
 * 90 are the numbers people already say, and having two unfamiliar ones
 * next to them is what makes the list feel like a suggestion rather than a
 * form.
 */
export const DURATION_PRESET_DAYS: readonly number[] = [21, 30, 45, 60, 90]

/**
 * The offered daily efforts, in minutes.
 *
 * Same reasoning: 10, 20, 30, 45, 60 and 90 are the numbers a person would
 * say out loud. 45 sits between 30 and 60 because that is where most people
 * put it when they mean "a proper sitting".
 */
export const DAILY_EFFORT_PRESET_MINUTES: readonly number[] = [10, 20, 30, 45, 60, 90]

/** What the presets are called in the UI. Shared: the word is the same. */
export const DURATION_UNIT_DAYS = 'days'
export const DAILY_EFFORT_UNIT_MINUTES = 'minutes'

export type NumberChoiceProblem = 'empty' | 'not-a-number' | 'out-of-range'

export type NumberChoiceResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly problem: NumberChoiceProblem; readonly message: string }

/**
 * Turns what someone typed into a whole number in range, or an explanation.
 *
 * The single place a typed number becomes a stored one. Refuses rather than
 * rounds, rather than clamps, and rather than guesses:
 *
 *   - "30.5" is refused, not rounded to 31. A Journey is a whole number of
 *     days; the user typed something that is not one, and silently
 *     changing it means the stored answer is not the answer they gave.
 *   - 0 and negatives are refused as out of range, not as "empty". They are
 *     the values this file exists to keep out of storage, and the message
 *     has to name the real range rather than claim nothing was typed.
 *   - A non-numeric string is refused as such, so "twelve" gets "Type a
 *     whole number" rather than a range complaint about a value ASCEND
 *     never managed to read.
 */
export function parseNumberChoice(
  raw: string,
  bounds: { min: number; max: number; unit: string },
): NumberChoiceResult {
  const trimmed = raw.trim()

  if (trimmed === '') {
    return {
      ok: false,
      problem: 'empty',
      message: `Type how many ${bounds.unit} you want.`,
    }
  }

  /*
   * Decimal digits, optionally signed, and NOTHING else.
   *
   * `Number()` alone is too generous here, and generously wrong. It reads
   * "0x1E" as 30, "1e2" as 100 and "0b11111" as 31, so a pasted hexadecimal
   * or exponential string would be stored as a number the user never typed —
   * and this phase exists to store exactly the answer somebody gave. It also
   * reads "30 days" as NaN, which is the one case the docstring above already
   * mentions; the pattern below reaches the same answer for that input while
   * refusing the others.
   *
   * The optional sign is kept so that "-5" is still an OUT-OF-RANGE answer
   * rather than an unreadable one. "Choose between 7 and 365 days" is the
   * right thing to say to somebody who typed a negative number, and it is a
   * different conversation from "type a whole number".
   *
   * `\d` is ASCII-only, so a number written in Arabic-Indic or Devanagari
   * digits is refused rather than misread as NaN. That is a real limitation
   * and it is pinned by a test: the message it produces is honest, and
   * guessing at a script's numeric system is a worse failure than saying
   * plainly that we could not read it.
   */
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return {
      ok: false,
      problem: 'not-a-number',
      message: `Type a whole number of ${bounds.unit}.`,
    }
  }

  const value = Number(trimmed)

  // A digit string long enough to overflow reads as Infinity, which is not a
  // safe integer and cannot be compared with the bounds meaningfully.
  if (!Number.isSafeInteger(value)) {
    return {
      ok: false,
      problem: 'not-a-number',
      message: `Type a whole number of ${bounds.unit}.`,
    }
  }

  if (value < bounds.min || value > bounds.max) {
    return {
      ok: false,
      problem: 'out-of-range',
      message: `Choose between ${bounds.min} and ${bounds.max} ${bounds.unit}.`,
    }
  }

  return { ok: true, value }
}

/**
 * The bounds for the duration question.
 *
 * Exported as an object rather than as three loose constants so a caller
 * cannot pass the effort minimum to the duration parser.
 */
export const DURATION_BOUNDS = {
  min: MIN_DURATION_DAYS,
  max: MAX_DURATION_DAYS,
  unit: DURATION_UNIT_DAYS,
} as const

/** The bounds for the daily effort question. See `DURATION_BOUNDS`. */
export const DAILY_EFFORT_BOUNDS = {
  min: MIN_DAILY_EFFORT_MINUTES,
  max: MAX_DAILY_EFFORT_MINUTES,
  unit: DAILY_EFFORT_UNIT_MINUTES,
} as const

/**
 * Is this value a whole number somebody could have chosen?
 *
 * The narrowest possible question, asked at the read boundary: one or more,
 * no fraction, no NaN, no Infinity. It deliberately says nothing about the
 * bounds.
 *
 * WHY THE BOUNDS ARE NOT CHECKED HERE
 *
 * A stored 500 days or 3 minutes cannot come from our own screens —
 * `parseNumberChoice` refuses it long before it could be stored — so it can
 * only be hand-edited storage or a draft written by a build with different
 * bounds. Both are cases where the honest answer is to KEEP the value and
 * let the step validator refuse the step with a message the user can act
 * on. Dropping it here would make the field look unanswered, which is a
 * different and false claim, and it would throw away a number somebody
 * genuinely gave us. This is the same rule ADR 0009 records for unresolved
 * Growth Area references: kept, and resolved by asking.
 *
 * `isBoundedNumberInRange` below is the check that has a message.
 */
export function isPositiveWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

/**
 * Normalizes a stored number for the read boundary.
 *
 * Returns the value when it is a positive whole number and null otherwise,
 * so `normalizeFields` can spread it conditionally exactly as it does the
 * Goal and the WHY — "the user has not answered this" having exactly one
 * representation in this codebase.
 *
 * This is where a stored 0 dies, and it is the reason the rule above is
 * "not zero" rather than "in range". Zero is not a duration and zero is not
 * an effort; it is what an untouched number input starts at and what an
 * empty box parses to, and letting it into the draft means every later
 * division and comparison has to defend against it.
 */
export function normalizeStoredCount(value: unknown): number | null {
  return isPositiveWholeNumber(value) ? value : null
}

/**
 * Is this stored number inside the range this build accepts?
 *
 * The check that has a message behind it, used by the step validators.
 *
 * False for `undefined` (never answered, `unanswered`), false for a
 * non-positive or fractional number (`out-of-range` — those shapes cannot be
 * anybody's intended answer), and false for a number outside the bounds
 * (`out-of-range` — somebody's real number that this build cannot honour).
 */
export function isBoundedNumberInRange(
  value: number | undefined,
  bounds: { min: number; max: number },
): boolean {
  if (!isPositiveWholeNumber(value)) return false
  return value >= bounds.min && value <= bounds.max
}

/**
 * Re-exported so a screen can seed a field from a stored number without
 * inventing its own default.
 *
 * The rule this protects: a number the user did not type must never be
 * typed into the box for them. An empty box on arrival is the truth, and a
 * pre-filled 30 that they never chose is a pre-filled answer.
 */
export function boundedNumberToText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}
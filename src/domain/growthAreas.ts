/**
 * Growth Areas — the things a user wants to get better at.
 *
 * This file is pure. No React, no storage, no DOM. Every rule about
 * naming, identity and duplicates lives here so it can be tested without
 * rendering anything, and so the same rules hold in Phase 11 when the
 * repository underneath is replaced with a Worker + D1 API.
 *
 * The three ideas that carry the whole design:
 *
 *   1. A Growth Area has TWO names.
 *      - `name` is what the user sees. It keeps THEIR capitalization,
 *        because "how I wrote it" is part of what they meant.
 *      - `id` is how we recognise it. It is the normalized name:
 *        trimmed, whitespace-collapsed, lowercased.
 *      Two names, because display and identity are genuinely different
 *      jobs. Deriving the id from the text means "Digital Marketing",
 *      " digital marketing " and "DIGITAL MARKETING" are provably the
 *      same area without a lookup table, and it means the same input
 *      produces the same id on any device in any session.
 *
 *   2. Suggested areas are SUGGESTIONS, not a fixed vocabulary.
 *      They live in code as a starting point, and a custom area is
 *      stored in exactly the same shape with exactly the same
 *      behaviour. Nothing downstream can tell them apart, which is the
 *      property that stops the suggestion list from quietly becoming a
 *      limit later.
 *
 *   3. Nothing about difficulty, points, colours or priorities lives
 *      here. Those were explicitly ruled out of this step, and keeping
 *      them out of the type means we cannot drift into building them by
 *      accident.
 */

export type GrowthAreaKind = 'suggested' | 'custom'

export interface GrowthArea {
  /** Normalized identity. See note 1 above. */
  readonly id: string
  /** Display text, preserving the user's own capitalization. */
  readonly name: string
  readonly kind: GrowthAreaKind
}

/** Long enough for "Digital Marketing", short enough for a phone screen. */
export const MAX_GROWTH_AREA_NAME_LENGTH = 60

/**
 * The starting suggestions.
 *
 * Deliberately plain, everyday words with no app jargon. This is not
 * the supported list — see note 2 above.
 */
export const SUGGESTED_GROWTH_AREA_NAMES: readonly string[] = [
  'Fitness',
  'Learning',
  'Coding',
  'Business',
  'Communication',
  'Creativity',
  'Reading',
  'Money',
  'Confidence',
  'Discipline',
]

export const SUGGESTED_GROWTH_AREAS: readonly GrowthArea[] = SUGGESTED_GROWTH_AREA_NAMES.map((name) => ({
  id: normalizeGrowthAreaName(name),
  name,
  kind: 'suggested' as const,
}))

/**
 * Collapses a name to its identity.
 *
 * Unicode-aware, so a non-breaking space or an ideographic space is
 * collapsed exactly like a normal one.
 */
export function normalizeGrowthAreaName(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ').toLowerCase()
}

/**
 * Cleans a name for display without changing its capitalization.
 *
 * "  Digital   Marketing " becomes "Digital Marketing" — the extra
 * spaces were never part of what the user meant — but the casing they
 * typed is preserved exactly.
 */
export function toGrowthAreaDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ')
}

export type GrowthAreaNameProblem = 'empty' | 'too-long' | 'no-words' | 'duplicate'

export type NewGrowthAreaResult =
  | { readonly ok: true; readonly area: GrowthArea }
  | { readonly ok: false; readonly problem: GrowthAreaNameProblem; readonly message: string }

/**
 * Validates a name the user typed, against the areas that already exist.
 *
 * The check order is deliberate:
 *
 *   1. EMPTY    — nothing to work with.
 *   2. TOO_LONG — a formatting problem the user can fix by typing less.
 *   3. NO_WORDS — pure decoration like "!!!" or "🎉" is not an area.
 *   4. DUPLICATE — only worth saying once the name is otherwise usable,
 *                  because "you already added X" is meaningless for "".
 *
 * Messages are written for a ten-year-old: say what is wrong, and say
 * what to do instead. No jargon, no error codes, no blame.
 */
export function createCustomGrowthArea(
  raw: string,
  existing: readonly GrowthArea[],
): NewGrowthAreaResult {
  const display = toGrowthAreaDisplayName(raw)
  const id = normalizeGrowthAreaName(raw)

  if (display === '') {
    return { ok: false, problem: 'empty', message: 'Type a name for your new area.' }
  }

  if (display.length > MAX_GROWTH_AREA_NAME_LENGTH) {
    return {
      ok: false,
      problem: 'too-long',
      message: `Keep it to ${MAX_GROWTH_AREA_NAME_LENGTH} letters or fewer.`,
    }
  }

  // Unicode-aware so that non-Latin scripts (Arabic, Hindi, Japanese,
  // emoji-free symbols) count as words. Only rejecting decorations
  // keeps this from quietly excluding people whose names are not ASCII.
  if (!/[\p{L}\p{N}]/u.test(display)) {
    return {
      ok: false,
      problem: 'no-words',
      message: 'Use at least one letter or number.',
    }
  }

  const clash = findById(existing, id)
  if (clash) {
    return {
      ok: false,
      problem: 'duplicate',
      message: `You already added “${clash.name}”.`,
    }
  }

  return { ok: true, area: { id, name: display, kind: 'custom' } }
}

/** The existing area with this identity, or undefined. */
export function findById(areas: readonly GrowthArea[], id: string): GrowthArea | undefined {
  return areas.find((area) => area.id === id)
}

/**
 * Merges suggested and custom areas into the single list the UI shows.
 *
 * Custom areas win on an identity clash. That cannot happen through the
 * normal flow — a duplicate is refused before it is created — but stored
 * data could have been edited by hand, and first-wins here keeps the
 * user's own spelling of a name they deliberately typed.
 */
export function mergeGrowthAreas(
  custom: readonly GrowthArea[],
  suggested: readonly GrowthArea[] = SUGGESTED_GROWTH_AREAS,
): GrowthArea[] {
  const merged: GrowthArea[] = []
  const seen = new Set<string>()

  for (const area of [...suggested, ...custom]) {
    if (seen.has(area.id)) continue
    seen.add(area.id)
    merged.push(area)
  }

  return merged
}
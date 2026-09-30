/**
 * Growth Areas — the things a user wants to get better at.
 *
 * This file is pure. No React, no storage, no DOM. Every rule about
 * naming, identity and duplicates lives here so it can be tested without
 * rendering anything, and so the same rules hold in Phase 11 when the
 * repository underneath is replaced with a Worker + D1 API.
 *
 * A Growth Area has THREE names, and conflating any two of them is the
 * mistake this file exists to prevent:
 *
 *   id             opaque, assigned once, never recomputed. This is what
 *                  milestones, daily actions, point events, reviews and
 *                  D1 rows reference. A rename cannot change it.
 *   name           what the user sees. Keeps THEIR capitalization,
 *                  because "how I wrote it" is part of what they meant.
 *   normalizedName the comparison key. Lowercased with whitespace
 *                  collapsed, used only to answer "are these the same
 *                  thing?". NEVER an identifier.
 *
 * Phase 2A used the normalized name AS the id. That made duplicates free
 * and renames impossible, and it is the second failure that undoes the
 * first. See growthAreaId.ts for what replaced it.
 *
 * Suggested areas are SUGGESTIONS, not a fixed vocabulary. They live in
 * code as a starting point and a custom area is stored in exactly the
 * same shape with exactly the same behaviour. Nothing downstream can
 * tell them apart, which is the property that stops the suggestion list
 * from quietly becoming a limit later.
 *
 * Nothing about difficulty, points, colours or priorities lives here.
 * Those were explicitly ruled out of this step, and keeping them out of
 * the type means we cannot drift into building them by accident.
 */

import { GROWTH_AREA_ID_PREFIX } from './growthAreaId'
import { normalizeGrowthAreaName, toGrowthAreaDisplayName } from './growthAreaName'

export type GrowthAreaKind = 'suggested' | 'custom'

export interface GrowthArea {
  /** Opaque, permanent. See the file comment. */
  readonly id: string
  /** Display text, preserving the user's own capitalization. */
  readonly name: string
  /** Comparison key only. Never store this as a reference. */
  readonly normalizedName: string
  readonly kind: GrowthAreaKind
}

/** Long enough for "Digital Marketing", short enough for a phone screen. */
export const MAX_GROWTH_AREA_NAME_LENGTH = 60

/**
 * The starting suggestions, as [id slug, display name].
 *
 * The id is written out rather than derived, and that is the whole
 * point: renaming "Communication" to "Talking" in a later release must
 * not invalidate a single stored reference, so the id is not a function
 * of the name. `suggestedGrowthAreaIds` pins this table in a test, which
 * turns these strings into a permanent contract — changing one is a
 * deliberate, reviewed act rather than an accident.
 */
const SUGGESTED: ReadonlyArray<readonly [slug: string, name: string]> = [
  ['fitness', 'Fitness'],
  ['learning', 'Learning'],
  ['coding', 'Coding'],
  ['business', 'Business'],
  ['communication', 'Communication'],
  ['creativity', 'Creativity'],
  ['reading', 'Reading'],
  ['money', 'Money'],
  ['confidence', 'Confidence'],
  ['discipline', 'Discipline'],
]

/**
 * The ten suggestions, with permanently stable ids.
 *
 * Everyday words, no app jargon. This is not the supported list — see the
 * file comment.
 */
export const SUGGESTED_GROWTH_AREAS: readonly GrowthArea[] = SUGGESTED.map(([slug, name]) => ({
  id: GROWTH_AREA_ID_PREFIX + slug,
  name,
  normalizedName: normalizeGrowthAreaName(name),
  kind: 'suggested' as const,
}))

export type GrowthAreaNameProblem = 'empty' | 'too-long' | 'no-words' | 'duplicate'

export type NewGrowthAreaResult =
  | { readonly ok: true; readonly area: GrowthArea }
  | { readonly ok: false; readonly problem: GrowthAreaNameProblem; readonly message: string }

/**
 * Validates a name the user typed, against the areas that already exist.
 *
 * `id` is a required parameter rather than a default. Generating an id
 * is the one impure act in this domain, so the caller — which knows
 * whether it is creating an area or migrating one — decides which id the
 * new area gets. Every test passes an explicit id and can therefore
 * assert on identity.
 *
 * The check order is deliberate:
 *
 *   1. EMPTY    — nothing to work with.
 *   2. TOO_LONG — a formatting problem the user can fix by typing less.
 *   3. NO_WORDS — pure decoration like "!!!" is not an area.
 *   4. DUPLICATE — only worth saying once the name is otherwise usable,
 *                  because "you already added X" is meaningless for "".
 *
 * Messages are written for a ten-year-old: say what is wrong, and say
 * what to do instead. No jargon, no error codes, no blame.
 */
export function createCustomGrowthArea(
  raw: string,
  existing: readonly GrowthArea[],
  id: string,
): NewGrowthAreaResult {
  const name = toGrowthAreaDisplayName(raw)
  const normalizedName = normalizeGrowthAreaName(raw)

  if (name === '') {
    return { ok: false, problem: 'empty', message: 'Type a name for your new area.' }
  }

  if (name.length > MAX_GROWTH_AREA_NAME_LENGTH) {
    return {
      ok: false,
      problem: 'too-long',
      message: `Keep it to ${MAX_GROWTH_AREA_NAME_LENGTH} letters or fewer.`,
    }
  }

  // Unicode-aware so non-Latin scripts count as words. Only rejecting
  // decoration keeps this from quietly excluding people whose names are
  // not ASCII.
  if (!/[\p{L}\p{N}]/u.test(name)) {
    return { ok: false, problem: 'no-words', message: 'Use at least one letter or number.' }
  }

  // Duplicates are compared by normalizedName, NOT by id: that is the
  // rule that makes casing and spacing irrelevant, and it still holds
  // now that ids are opaque.
  const clash = findByNormalizedName(existing, normalizedName)
  if (clash) {
    return {
      ok: false,
      problem: 'duplicate',
      message: `You already added “${clash.name}”.`,
    }
  }

  return { ok: true, area: { id, name, normalizedName, kind: 'custom' } }
}

/** The area with this identity, or undefined. */
export function findById(areas: readonly GrowthArea[], id: string): GrowthArea | undefined {
  return areas.find((area) => area.id === id)
}

/** The area a user would consider "the same one", or undefined. */
export function findByNormalizedName(
  areas: readonly GrowthArea[],
  normalizedName: string,
): GrowthArea | undefined {
  // Normalized on the way in as well as on the way out. An exact match
  // would return `undefined` for ' PIANO ' instead of 'piano', and a
  // silently empty lookup is exactly the kind of failure that becomes a
  // duplicate the user is told they do not have. Normalizing is
  // idempotent, so this cannot produce a false positive.
  const wanted = normalizeGrowthAreaName(normalizedName)
  return areas.find((area) => area.normalizedName === wanted)
}

/**
 * Merges suggested and custom areas into the single list the UI shows.
 *
 * Two different collisions are handled, and they are not the same bug:
 *
 *   SAME ID          the same area stored twice. Only reachable through
 *                    hand-edited or legacy data. Dropped.
 *   SAME NORMALIZED  two distinct areas with a name the user would call
 *      NAME           identical. Also unreachable through the normal
 *                    flow, because a duplicate is refused on creation.
 *                    Dropped, and suggestions come first so the built-in
 *                    name is the one that survives.
 */
export function mergeGrowthAreas(
  custom: readonly GrowthArea[],
  suggested: readonly GrowthArea[] = SUGGESTED_GROWTH_AREAS,
): GrowthArea[] {
  const merged: GrowthArea[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const area of [...suggested, ...custom]) {
    if (seenIds.has(area.id) || seenNames.has(area.normalizedName)) continue
    seenIds.add(area.id)
    seenNames.add(area.normalizedName)
    merged.push(area)
  }

  return merged
}

/**
 * A milestone: one real outcome the user could point to.
 *
 * A milestone is the only part of onboarding that is a LIST of the user's
 * own sentences, which makes it the first place in this codebase where a
 * stored record has an identity of its own. So the same rule that governs
 * Growth Areas governs it: an id assigned once, never derived from the text.
 *
 * WHY THE ID CANNOT COME FROM THE TEXT
 *
 * Every milestone the user writes will be about the same things — running,
 * deploying, speaking. If the id were a hash of the sentence, correcting a
 * typo would mint a new milestone and orphan everything that pointed at
 * the old one, and "Run my first 5k" and "run my first 5K" would be two
 * milestones. Editing a milestone must change the sentence and nothing
 * else. See growthAreaId.ts, where the same bug already happened once.
 *
 * WHY ONLY STRUCTURE IS CHECKED
 *
 * ASCEND does not judge whether "Run 5 km without stopping" is achievable,
 * ambitious or realistic for this person. A milestone is the only part of
 * onboarding where over-ambition is common and harmless — the whole point
 * is to name something worth doing, and the daily plan is where ambition
 * gets made realistic. So the rules below are: not blank, not absurdly
 * long, not a duplicate of something already on the list, and no more than
 * five.
 *
 * WHY FIVE
 *
 * A list of twenty is not a milestone list, it is a wish list, and it cannot
 * be used to plan a day. Five is enough to cover a real journey and short
 * enough that every item stays sharp. One is the minimum because "what
 * would prove you are making progress" has no answer in an empty list.
 *
 * WHY THERE IS NO "DOES IT CONTAIN A WORD" CHECK, WHICH GROWTH AREAS HAVE
 *
 * The custom Growth Area composer rejects "!!!" as decoration, and it is
 * right to: an AREA is a label in a chip grid, so "!!!" renders as visual
 * noise sitting between two real names. A milestone is a sentence in a list —
 * exactly the kind of thing `goal` and `why` are — and personalAnswer.ts
 * already settled this question for sentences. One word is a complete
 * answer, and ASCEND does not inspect vocabulary. So "🎹" is a legal
 * milestone here for the same reason "Piano" is.
 *
 * The alternative was considered and rejected: rejecting a milestone with no
 * letters would read to the user as ASCEND grading their ambition, which is
 * the one thing this phase is required not to do. If that ever needs
 * changing it changes HERE, in one function, and not scattered across screens.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * No `completed`, no `completedAt`, no percentage, no points, no Growth
 * Area ownership. A milestone here is a sentence somebody typed, and
 * everything that tracks whether it happened belongs to the real Journey in
 * Phase 2D. Keeping them out of the type is what stops us building them by
 * accident in a screen.
 */

import { createGrowthAreaId } from './growthAreaId'
import { hashedIdSuffix } from './idHash'

/**
 * A milestone as stored in the draft.
 *
 * Journey-level for V1: milestones describe the whole plan, not one Growth
 * Area, exactly as the Goal and the WHY do (ADR 0010). So nothing here can
 * be orphaned by a deselection, and nothing has to be resolved at Summary
 * for that reason.
 */
export interface DraftMilestone {
  /** Opaque, permanent, never recomputed from the text. */
  readonly id: string
  /** The user's own sentence. Trimmed at the ends, otherwise untouched. */
  readonly text: string
}

/** Long enough for "Talk to 10 potential customers in my target market". */
export const MAX_MILESTONE_LENGTH = 120

/** Fewest a plan can prove anything with. */
export const MIN_MILESTONES = 1

/** The most a list can stay sharp at. See the note above. */
export const MAX_MILESTONES = 5

/**
 * The milestone namespace.
 *
 * Disjoint from the Growth Area namespaces (`ga_s_`, `ga_c_`, `ga_m_`) by
 * prefix, so a milestone id can never be mistaken for an area id even though
 * both are followed by characters from the same alphabet. A Journey will hold
 * both kinds of record and a D1 row will eventually carry both; being able to
 * tell them apart from the string alone is worth the one extra character.
 *
 * Deliberately NOT `ga_m_`. That prefix already means "a Growth Area whose id
 * had to be reconstructed from a name", and reusing it here would make two
 * different recoveries indistinguishable.
 */
export const MILESTONE_ID_PREFIX = 'ms_'

/**
 * A milestone id, minted in the same namespace shape as the Growth Area ids
 * so the two never collide and a log line says which kind of record it is.
 *
 * Growth Area ids are already random and already the only impure function
 * in the domain, so the randomness is reused rather than written a second
 * time. `ga_c_` is stripped rather than renamed: what matters is that the
 * id is opaque and stable, and a second id factory would be a second
 * implementation of "unbiased random string" to keep correct.
 *
 * Sixteen characters after the prefix, against fourteen for a recovered id.
 * The widths differ for the same reason `ga_c_` and `ga_m_` differ: it means
 * a minted id and a recovered one can never be confused, even though both are
 * legal characters.
 */
export function createMilestoneId(): string {
  return createGrowthAreaId().replace(/^ga_c_/, MILESTONE_ID_PREFIX)
}

/**
 * The comparison key for a milestone.
 *
 * Case-folded, with punctuation and spacing removed, so "Run 5 km" and
 * "run 5km" are recognised as the same outcome. This is a DUPLICATE CHECK and
 * nothing else: it never becomes an id, and the text the user sees and stores
 * keeps its own capitals, its own punctuation and its own emoji.
 *
 * WHY SYMBOLS ARE KEPT WHEN PUNCTUATION IS NOT
 *
 * Stripping `\p{S}` as well was the obvious next step, and it is wrong here.
 * Emoji are `\p{S}` — most of them are "Symbol, other" — so stripping them
 * collapses "🎹" and "🥁" to the same empty string, and the second one is
 * refused as a duplicate of the first. The brief requires emoji to be legal
 * milestones, and refusing a distinct one because it is also made of symbols
 * is a false duplicate: it BLOCKS somebody from writing something they meant
 * while claiming they already wrote it. A false duplicate is worse than a
 * missed near-duplicate — the near-duplicate costs a list entry, this one
 * costs an answer.
 *
 * The price is that "Earn $1000" and "Earn 1000" are treated as different,
 * because `$` is a symbol. That is the safe direction: both sentences are
 * still legal, and the user can delete one. Nothing is refused that they
 * wrote.
 */
export function normalizeMilestoneText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\s]+/gu, '')
}

/** The cleaned text, or null when there is nothing to store. */
export function toMilestoneText(raw: string): string | null {
  const text = raw.trim()
  return text === '' ? null : text
}

/** What a milestone can be refused for. */
export type MilestoneProblem = 'empty' | 'too-long' | 'duplicate'

export type NewMilestoneResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: MilestoneProblem; readonly message: string }

/**
 * Validates a milestone the user typed, against the ones already written.
 *
 * Mirrors `createCustomGrowthArea`'s shape and its check order, and the order
 * is the same for the same reason: `empty` has nothing to build on,
 * `too-long` is a formatting problem they can fix by typing less, and
 * `duplicate` is only worth saying once the text is otherwise usable —
 * "you already added that" is meaningless for "".
 *
 * TWO ARGUMENTS IT DELIBERATELY DOES NOT TAKE
 *
 *   The maximum COUNT. How many milestones exist is a property of the draft,
 *   and the count limit is enforced by the step validator and by the screen
 *   hiding the add control. Folding it in here would make "is this text
 *   legal" depend on unrelated state, so the same function would answer
 *   differently for the same text.
 *
 *   An id. Minting one is the only impure act in this domain, so the caller
 *   decides when it happens and identity is never a side effect of
 *   validating. That is why `addMilestone` in onboardingDraft.ts takes an id
 *   parameter rather than calling `createMilestoneId` from here.
 *
 * `existing` is compared by normalized text and NEVER by id. Two identical
 * sentences have two different ids, so an id-based check would let the same
 * milestone through every single time — which is the bug this whole module
 * exists to prevent, in a different direction.
 */
export function validateMilestoneText(
  raw: string,
  existing: readonly DraftMilestone[],
): NewMilestoneResult {
  const text = toMilestoneText(raw)

  if (text === null) {
    return { ok: false, problem: 'empty', message: 'Type what you want to prove.' }
  }

  if (text.length > MAX_MILESTONE_LENGTH) {
    return {
      ok: false,
      problem: 'too-long',
      message: `Keep it to ${MAX_MILESTONE_LENGTH} letters or fewer.`,
    }
  }

  const wanted = normalizeMilestoneText(text)
  if (existing.some((milestone) => normalizeMilestoneText(milestone.text) === wanted)) {
    return { ok: false, problem: 'duplicate', message: 'You already wrote that one.' }
  }

  return { ok: true, text }
}

/**
 * Rebuilds a milestone from stored text that cannot be trusted.
 *
 * Same two rules as every normaliser in this codebase: the id is READ and
 * never re-derived, because identity is the one thing we must not
 * recompute; and a blank sentence is not a milestone, so it is dropped
 * rather than stored and displayed as an empty row.
 */
export function normalizeMilestone(value: unknown): DraftMilestone | null {
  if (typeof value !== 'object' || value === null) return null

  const milestone = value as { id?: unknown; text?: unknown }
  if (typeof milestone.text !== 'string') return null

  const text = toMilestoneText(milestone.text)
  if (text === null) return null

  // Lenient about the id's shape for the same reason Growth Areas are:
  // rejecting an id we do not recognise would silently drop a sentence
  // somebody wrote, which is far worse than carrying an odd id.
  const id =
    typeof milestone.id === 'string' && milestone.id.trim() !== ''
      ? milestone.id.trim()
      : recoveredMilestoneId(text)

  return { id, text }
}

/**
 * The id for a milestone whose stored id was missing or blank.
 *
 * Hashed from the text rather than generated, so repairing the same draft
 * twice produces the same identity. A random id here would re-mint the
 * milestone on every page load, and the user would watch their own list
 * shuffle under them — which is the same failure `migratedGrowthAreaId` was
 * built to avoid, so it uses the same hash rather than a second copy of one.
 * Two copies of a hash is two sets of ids: repairing a Growth Area one
 * release and a milestone the next would silently disagree about what "the
 * same text" means, and nothing would notice until a reference stopped
 * resolving. See idHash.ts.
 *
 * NOT name-derived identity. The result is computed once, stored, and opaque
 * forever after; correcting the sentence does not move it.
 */
export function recoveredMilestoneId(text: string): string {
  return MILESTONE_ID_PREFIX + hashedIdSuffix(normalizeMilestoneText(text))
}

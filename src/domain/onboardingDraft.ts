/**
 * The onboarding draft.
 *
 * A draft is a private, resumable, throwaway record of what the user has
 * told us so far. It is NOT a Journey. Nothing here is precious, but it
 * is also not disposable: if the user answered something and we lose it,
 * that is the single most annoying thing this app could do. So the rules
 * below all point the same way.
 *
 * WHY duration, milestones AND dailyEffortMinutes ARE OPTIONAL
 *
 * Absent, never a default. `durationDays?: number` and not
 * `durationDays: 0`, because zero is a real number and never a valid
 * answer, so storing it would invent a third state between "answered" and
 * "not answered". `milestones?: []` has the same problem as `goal: ''`:
 * an empty list reads as "answered, and the answer is nothing", and a
 * question that has not been asked must not be able to look like a
 * question that was answered badly. `createOnboardingDraft` sets none of
 * the three, and a test asserts a fresh draft holds none of them.
 *
 * WHY goal AND why ARE OPTIONAL, NOT BLANK
 *
 * `goal?: { text: string }` rather than `goal: { text: '' }`. The field is
 * in the type from Phase 2B, but `createOnboardingDraft` does not set it,
 * and `toPersonalAnswer` in personalAnswer.ts is the only thing that can
 * create one. So an unanswered question is ABSENT, which is the truth, and
 * no screen can invent a default. A test asserts a fresh draft holds
 * neither field, even though the type has room for both.
 *
 * WHY EVERYTHING REFERENCES AN ID
 *
 * `selectedGrowthAreaIds` and `customGrowthAreas` both key on `id`.
 * Nothing in a draft points at a name. Milestones, daily actions, point
 * events, reviews and D1 rows will do the same, which is why renaming an
 * area is safe.
 *
 * WHY SELECTION AND DEFINITION ARE SEPARATE
 *
 *   customGrowthAreas      — areas the user has created. Never removed
 *                            by deselecting.
 *   selectedGrowthAreaIds  — the ids currently chosen. Only this list
 *                            changes when the user toggles something.
 *
 * This split is the whole "never silently destroy later work" guarantee.
 * Toggling off an area cannot delete the area itself, and it cannot
 * touch any other field of the draft, because the toggle functions below
 * are pure projections over exactly one key.
 *
 * The Goal and the WHY are deliberately OUTSIDE this split. They are one
 * answer each, for the Journey as a whole, and Phase 2C's milestones are
 * where per-area data begins. See ADR 0010.
 *
 * WHAT HAPPENS WHEN A LATER ANSWER IS ORPHANED
 *
 * Confirmed product rule: if a user deselects a Growth Area that later
 * draft data refers to, the later data is KEPT and the reference is marked
 * unresolved. At Summary the user must explicitly choose one of:
 *
 *   restore the Growth Area · assign another one · edit the dependent item
 *   · intentionally remove it
 *
 * Nothing is ever deleted to tidy this up. An orphaned milestone is a
 * sentence somebody typed; silently dropping it because a chip was
 * deselected is exactly the "never punish the user" failure the product
 * rules forbid.
 *
 * `goal` and `why` CANNOT be orphaned, and that is a design decision
 * rather than luck: they are not keyed by an area id at all, because they
 * describe the Journey as a whole. A Journey spans every Growth Area the
 * user picked, so there is no single area for them to point at and nothing
 * for a deselection to break. ADR 0010 records why. The rule above still
 * binds everything from `milestones` onwards, which genuinely are
 * per-area, and `reconcileSelections` below is deliberately NOT extended
 * to touch dependent data when that data arrives.
 */

import { MAX_GROWTH_AREA_NAME_LENGTH, mergeGrowthAreas } from './growthAreas'
import { migratedGrowthAreaId } from './growthAreaId'
import { normalizeGrowthAreaName, toGrowthAreaDisplayName } from './growthAreaName'
import {
  MAX_MILESTONES,
  MIN_MILESTONES,
  validateMilestoneText,
  type MilestoneProblem,
} from './milestone'
import type { DraftMilestone } from './milestone'
import { toPersonalAnswer } from './personalAnswer'
import type { PersonalAnswer } from './personalAnswer'
import { isPositiveWholeNumber } from './schedule'
import type { GrowthArea } from './growthAreas'

/**
 * The draft's own milestone record type, re-exported so a caller holding an
 * `OnboardingDraft` does not have to know which file defines the shape of a
 * field. The RULES live in milestone.ts and stay there.
 */
export type { DraftMilestone }

/**
 * Bumped when a stored draft would be read WRONG by a build other than the
 * one that wrote it — either an old draft the new build cannot reconstruct,
 * or a new draft an older build would quietly damage.
 *
 * See onboardingDraftRepository.ts for the migrations that carry older
 * drafts forward, and for the rule that stops a newer draft being
 * overwritten by a build that cannot represent it.
 *
 *   1  Phase 2A.  Ids WERE normalized names.
 *   2  Ids became opaque, but shared one `ga_` prefix.
 *   3  Ids gained explicit per-origin namespaces: ga_s_ / ga_c_ / ga_m_.
 *   4  The draft carries a Goal and a WHY.
 *   5  The draft carries a Duration, Milestones and a Daily Effort.
 *
 * WHY ADDING goal AND why MADE IT 4, AND THESE MAKE IT 5
 *
 * Phase 2B first shipped goal/why WITHOUT a bump, on the theory that an
 * older build would simply ignore a key it had no name for. It does not.
 * The v3 reader rebuilds the draft from the six keys it knows
 * (`normalizeFields` in onboardingDraftRepository.ts), so the next normal
 * write — selecting an area, typing a Goal — DELETES `goal` and `why`. That
 * was not reasoned about; it was proved by checking out the real v3 code
 * from commit 112d82d in a worktree and running a v3 draft through it. The
 * fields did not survive, byte for byte or otherwise.
 *
 * The identical argument applies here, one version later: a v4 build
 * writing a draft it can read would delete durationDays, milestones and
 * dailyEffortMinutes on the very next tap. The number is what makes that
 * legible, and it is what lets this build refuse to load or overwrite a
 * draft whose version is higher than it understands — so a v4 build seeing
 * a v5 draft stops rather than rewriting it, and the newer answers stay on
 * disk for the build that can read them. See ADR 0012.
 */
export const ONBOARDING_SCHEMA_VERSION = 5

/**
 * The full ordered list of onboarding steps.
 *
 * Only the first two are reachable in Phase 2A. The rest are declared
 * because `currentStep` has to be able to name the step the user is on,
 * and because the sequence is a product decision worth writing down once
 * instead of scattering across screens.
 */
export const ONBOARDING_STEPS = [
  'welcome',
  'growth-areas',
  'goal',
  'why',
  'duration',
  'milestones',
  'daily-effort',
  'summary',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/** The step a completed step advances to. `summary` is the last one. */
export function nextStep(step: OnboardingStep): OnboardingStep | undefined {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < 0 || index === ONBOARDING_STEPS.length - 1) return undefined
  return ONBOARDING_STEPS[index + 1]
}

/** A custom area as stored in the draft: the persisted projection of a GrowthArea. */
export interface DraftGrowthArea {
  /** Opaque, permanent, and never recomputed from the name. */
  readonly id: string
  readonly name: string
  /** Comparison key only. */
  readonly normalizedName: string
}

export interface OnboardingDraft {
  readonly schemaVersion: typeof ONBOARDING_SCHEMA_VERSION
  /**
   * Navigation and resume position ONLY.
   *
   * It does NOT mean earlier answers are valid. A draft can be sitting on
   * `currentStep: 'goal'` with a selection that no longer resolves to
   * any area, and `validateOnboardingDraft` will still refuse it. Never
   * infer "answered" from this field.
   */
  readonly currentStep: OnboardingStep
  /** Ids of chosen areas, in the order they were chosen. */
  readonly selectedGrowthAreaIds: readonly string[]
  /** Every custom area the user has created, chosen or not. */
  readonly customGrowthAreas: readonly DraftGrowthArea[]
  /**
   * What the user would love to achieve, in their own words.
   *
   * ABSENT until they have actually written something, and never
   * `{ text: '' }` — see personalAnswer.ts. One answer for the whole
   * Journey rather than one per Growth Area, because a Journey spans all
   * of them. See ADR 0010.
   */
  readonly goal?: PersonalAnswer
  /**
   * Why this matters to them. First-class data, not decoration: Recovery,
   * reflection and milestone moments will read it back.
   *
   * Same absence rule as `goal`, and the same Journey-level scope.
   */
  readonly why?: PersonalAnswer
  /**
   * How long the Journey runs, in whole days.
   *
   * ABSENT until answered, never 0, and never a calendar date — a draft
   * written on Sunday and one written on Monday would otherwise be
   * different answers to the same question. See schedule.ts.
   */
  readonly durationDays?: number
  /**
   * What would prove this is working, in the user's own words.
   *
   * NEVER an empty array. Removing the last milestone DELETES this key, so
   * "not written yet" and "written and then deleted" cannot both be an
   * empty list. Between MIN_MILESTONES and MAX_MILESTONES.
   */
  readonly milestones?: readonly DraftMilestone[]
  /**
   * Realistically, minutes a day. Planning context, never a score.
   *
   * Same absence rule as `durationDays`, and for the same reason.
   */
  readonly dailyEffortMinutes?: number
  readonly startedAt: string
  readonly updatedAt: string
}

/**
 * A fresh draft.
 *
 * `now` is injected rather than read from the clock so every function in
 * this file stays pure and a test can assert an exact timestamp.
 */
export function createOnboardingDraft(now: string): OnboardingDraft {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    currentStep: 'welcome',
    selectedGrowthAreaIds: [],
    customGrowthAreas: [],
    startedAt: now,
    updatedAt: now,
  }
}

/**
 * Every area this draft knows about: the suggestions plus the customs.
 *
 * Callers get one list rather than juggling two, which is what makes a
 * custom area indistinguishable from a suggested one everywhere else.
 */
export function knownGrowthAreas(draft: OnboardingDraft): GrowthArea[] {
  return mergeGrowthAreas(
    draft.customGrowthAreas.map((area) => ({ ...area, kind: 'custom' as const })),
  )
}

export function isSelected(draft: OnboardingDraft, id: string): boolean {
  return draft.selectedGrowthAreaIds.includes(id)
}

/**
 * Toggles one area on or off.
 *
 * Three properties this function is written to guarantee, each of which
 * has a test:
 *
 *   1. An unknown id is a NO-OP. A stale link or a tampered store cannot
 *      invent a selection.
 *   2. Deselecting removes the id from the selection list ONLY. The
 *      custom area definition and every other field survive untouched.
 *   3. Selecting an already-selected id is a no-op, so the selection
 *      order is the order the user actually chose in.
 */
export function toggleGrowthArea(draft: OnboardingDraft, id: string, now: string): OnboardingDraft {
  if (!knownGrowthAreas(draft).some((area) => area.id === id)) return draft

  return isSelected(draft, id)
    ? deselectGrowthArea(draft, id, now)
    : selectGrowthArea(draft, id, now)
}

/**
 * The guard lives here rather than in `toggleGrowthArea` because this is
 * the function that actually adds to the list: an unknown id must be
 * refused at the only place that can refuse it, or a caller that skips
 * `toggle` can still create a selection the UI cannot display.
 */
export function selectGrowthArea(
  draft: OnboardingDraft,
  id: string,
  now: string,
): OnboardingDraft {
  if (isSelected(draft, id)) return draft
  if (!knownGrowthAreas(draft).some((area) => area.id === id)) return draft

  return { ...draft, selectedGrowthAreaIds: [...draft.selectedGrowthAreaIds, id], updatedAt: now }
}

export function deselectGrowthArea(
  draft: OnboardingDraft,
  id: string,
  now: string,
): OnboardingDraft {
  if (!isSelected(draft, id)) return draft

  return {
    ...draft,
    selectedGrowthAreaIds: draft.selectedGrowthAreaIds.filter((selected) => selected !== id),
    updatedAt: now,
  }
}

/**
 * Records a custom area and selects it.
 *
 * Selecting on creation is the friendly reading of intent: nobody types a
 * personal growth area they do not want. It is a single function rather
 * than two so the two facts cannot drift apart — an area cannot be
 * created in a half-applied state.
 *
 * Only `id`, `name` and `normalizedName` are stored. `kind` is
 * deliberately dropped even though the caller usually holds a full
 * `GrowthArea`: which list an area came from already says what it is, so
 * persisting `kind` would be a second source of truth that could one day
 * contradict the first.
 */
export function addCustomGrowthArea(
  draft: OnboardingDraft,
  area: GrowthArea | DraftGrowthArea,
  now: string,
): OnboardingDraft {
  const stored: DraftGrowthArea = {
    id: area.id,
    name: area.name,
    normalizedName: area.normalizedName,
  }

  if (draft.customGrowthAreas.some((existing) => existing.id === stored.id)) return draft

  return {
    ...draft,
    customGrowthAreas: [...draft.customGrowthAreas, stored],
    selectedGrowthAreaIds: isSelected(draft, stored.id)
      ? draft.selectedGrowthAreaIds
      : [...draft.selectedGrowthAreaIds, stored.id],
    updatedAt: now,
  }
}

/**
 * Renames a custom area WITHOUT changing its identity.
 *
 * This function exists to make one rule enforceable rather than merely
 * stated: a rename must never invalidate a reference. Every field except
 * the id changes; the id is read, never written.
 *
 * The rename is refused if the new name duplicates an area that already
 * exists, using exactly the same comparison as creation, so "Piano" and
 * "piano" still cannot both exist. A rename that would collide with
 * another CUSTOM area's name is allowed only if it is that area's own
 * name, so renaming a thing to its current name is a no-op rather than an
 * error.
 *
 * Selection is untouched: the area stays selected because it is the same
 * area, and a user who renames "Piano" has not changed their mind about
 * working on it.
 */
export function renameCustomGrowthArea(
  draft: OnboardingDraft,
  id: string,
  raw: string,
  now: string,
):
  | { readonly ok: true; readonly draft: OnboardingDraft }
  | { readonly ok: false; readonly problem: GrowthAreaProblem; readonly message: string } {
  const target = draft.customGrowthAreas.find((area) => area.id === id)
  if (!target) {
    return { ok: false, problem: 'not-found', message: 'That area is no longer here.' }
  }

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

  if (!/[\p{L}\p{N}]/u.test(name)) {
    return { ok: false, problem: 'no-words', message: 'Use at least one letter or number.' }
  }

  // Compared against every other area — suggestions included — because a
  // custom area is never allowed to shadow a suggestion.
  const others = knownGrowthAreas(draft).filter((area) => area.id !== id)
  const clash = others.find((area) => area.normalizedName === normalizedName)
  if (clash) {
    return { ok: false, problem: 'duplicate', message: `You already added “${clash.name}”.` }
  }

  return {
    ok: true,
    draft: {
      ...draft,
      customGrowthAreas: draft.customGrowthAreas.map((area) =>
        area.id === id ? { ...area, name, normalizedName } : area,
      ),
      updatedAt: now,
    },
  }
}

/** The two free-text answers the draft holds. */
type AnswerField = 'goal' | 'why'

/**
 * Records what the user would love to achieve.
 *
 * Every property below has a test, because each one is a way to lose a
 * sentence somebody wrote:
 *
 *   1. Blank removes the field rather than storing `''`. An absent answer
 *      and an empty one are different, and only the first is true.
 *   2. The stored text is trimmed at both ends and nothing else. Internal
 *      spacing, line breaks, punctuation, capitalisation and emoji are the
 *      user's, and are not ours to tidy.
 *   3. Identical text is not a change — the same object comes back — so
 *      re-saving an untouched answer does not rewrite storage.
 *   4. It touches nothing else in the draft. Growth Areas, the WHY and the
 *      timestamps' callers are unaffected except `updatedAt`.
 *
 * `why` is set by `setWhy`, which is the same function with a different
 * field name. One implementation, so the two steps cannot drift apart in
 * how they treat an empty box.
 */
export function setGoal(draft: OnboardingDraft, raw: string, now: string): OnboardingDraft {
  return setAnswer(draft, 'goal', raw, now)
}

/** Records why this matters to them. Identical rules to `setGoal`. */
export function setWhy(draft: OnboardingDraft, raw: string, now: string): OnboardingDraft {
  return setAnswer(draft, 'why', raw, now)
}

function setAnswer(
  draft: OnboardingDraft,
  field: AnswerField,
  raw: string,
  now: string,
): OnboardingDraft {
  const answer = toPersonalAnswer(raw)

  // Same object back for the same text, so OnboardingDraftProvider can use
  // identity to skip a storage write. Without this every keystroke that
  // changes nothing visible would still hit localStorage.
  if ((answer?.text ?? undefined) === draft[field]?.text) return draft

  if (!answer) {
    // The key is DELETED, not set to undefined. `goal: undefined` still
    // shows up in `Object.keys` and in a naive JSON round-trip, and
    // "the field exists but is empty" is the exact ambiguity this whole
    // field is designed to avoid.
    const { [field]: _removed, ...rest } = draft
    return { ...rest, updatedAt: now }
  }

  return { ...draft, ...answerFor(field, answer), updatedAt: now }
}

function answerFor(field: AnswerField, answer: PersonalAnswer): Partial<OnboardingDraft> {
  return field === 'goal' ? { goal: answer } : { why: answer }
}

/** The two numeric answers the draft holds. */
type CountField = 'durationDays' | 'dailyEffortMinutes'

/**
 * Records how long the Journey runs, in days.
 *
 * `setDailyEffortMinutes` is this function with a different field name, for
 * the same reason `setWhy` is `setGoal`: one implementation, so the two
 * numeric steps cannot drift apart in how they treat a value that is not an
 * answer.
 *
 * The rules, each of which is a way to store something that is not what the
 * user said:
 *
 *   1. `undefined` DELETES the field. Blank means unanswered, which is the
 *      truth and has one representation.
 *   2. A number that is not a positive whole number also DELETES. Zero is
 *      not a short duration; it is what an empty number input parses to, and
 *      letting it in means every later division has to defend against it.
 *      `isPositiveWholeNumber` is the rule, imported from schedule.ts so the
 *      setter and the read boundary cannot disagree.
 *   3. A POSITIVE WHOLE NUMBER IS STORED EVEN IF OUT OF RANGE. Our own
 *      screens cannot produce one — `parseNumberChoice` refuses it before
 *      this is ever called — so an out-of-range value can only come from
 *      hand-edited storage or a build with different bounds. Clamping it to
 *      the nearest bound here would be a lie about what was chosen, and
 *      dropping it would throw away a real answer. The step validator
 *      refuses the step with a message instead.
 *   4. The same number again returns the identical draft, so re-selecting a
 *      preset costs no storage write.
 *   5. Nothing else in the draft is touched. In particular `currentStep` is
 *      untouched: this records an answer, not a position.
 */
export function setDurationDays(
  draft: OnboardingDraft,
  value: number | undefined,
  now: string,
): OnboardingDraft {
  return setCount(draft, 'durationDays', value, now)
}

/** Records realistic daily effort, in minutes. Identical rules to `setDurationDays`. */
export function setDailyEffortMinutes(
  draft: OnboardingDraft,
  value: number | undefined,
  now: string,
): OnboardingDraft {
  return setCount(draft, 'dailyEffortMinutes', value, now)
}

function setCount(
  draft: OnboardingDraft,
  field: CountField,
  value: number | undefined,
  now: string,
): OnboardingDraft {
  if (!isPositiveWholeNumber(value)) {
    if (!(field in draft)) return draft
    const { [field]: _removed, ...rest } = draft
    return { ...rest, updatedAt: now }
  }

  if (draft[field] === value) return draft

  return { ...draft, [field]: value, updatedAt: now }
}

/** What a milestone operation can refuse, and why. */
export type MilestoneWriteProblem =
  | MilestoneProblem
  /** The list already holds MAX_MILESTONES. */
  | 'too-many'
  /** The id named no milestone in this draft. */
  | 'not-found'

export type MilestoneWriteResult =
  | { readonly ok: true; readonly draft: OnboardingDraft }
  | {
      readonly ok: false
      readonly problem: MilestoneWriteProblem
      readonly message: string
    }

/**
 * Records a milestone.
 *
 * One function that validates AND commits, rather than a validating call
 * followed by a committing one, for the reason `renameCustomGrowthArea` is
 * one function: an area cannot be created in a half-applied state, and
 * neither can a milestone.
 *
 * `id` is a required parameter for the reason `createCustomGrowthArea`
 * takes one. Generating an id is the only impure act in this domain, so the
 * caller decides when it happens and a test can assert on identity.
 *
 * The check order puts `too-many` FIRST, unlike `createCustomGrowthArea`.
 * A full list means the action itself is unavailable, and "you already have
 * five" is a more useful thing to say than anything about the text — the
 * screen hides the add control at the limit, so this branch is a backstop
 * rather than a daily path.
 *
 * Appending preserves the order they were added in, which is the order a
 * person thought of them in and the order Phase 2D will read them back.
 */
export function addMilestone(
  draft: OnboardingDraft,
  id: string,
  raw: string,
  now: string,
): MilestoneWriteResult {
  const existing = draft.milestones ?? []

  if (existing.length >= MAX_MILESTONES) {
    return {
      ok: false,
      problem: 'too-many',
      message: `Keep it to ${MAX_MILESTONES} or fewer — try to combine two.`,
    }
  }

  const result = validateMilestoneText(raw, existing)
  if (!result.ok) return result

  const milestone: DraftMilestone = { id, text: result.text }

  return {
    ok: true,
    draft: { ...draft, milestones: [...existing, milestone], updatedAt: now },
  }
}

/**
 * Changes what a milestone says without changing what it IS.
 *
 * The rule this exists to make enforceable: an edit must never move a
 * milestone's id. Everything except the id changes; the id is read, never
 * written. See milestone.ts for why that matters — a later phase hangs
 * daily actions, point events and a Journey row off it.
 *
 * Three properties, each with a test:
 *
 *   1. The milestone being edited is EXCLUDED from the duplicate check.
 *      Without that, saving an unchanged sentence would report "You already
 *      wrote that one" about the very milestone being edited, and no
 *      milestone could ever be saved without first being changed. This is
 *      the one bug most likely to be introduced here, which is why the
 *      exclusion is a separate named value rather than a filter inline.
 *   2. Identical text returns the IDENTICAL draft, so an edit nobody actually
 *      made costs no storage write — the same rule `setAnswer` follows.
 *   3. An unknown id is refused rather than creating a second milestone.
 *      The id is the only handle we have, so a stale one must not silently
 *      add to the list.
 */
export function editMilestone(
  draft: OnboardingDraft,
  id: string,
  raw: string,
  now: string,
): MilestoneWriteResult {
  const existing = draft.milestones ?? []

  if (!existing.some((milestone) => milestone.id === id)) {
    return { ok: false, problem: 'not-found', message: 'That one is no longer here.' }
  }

  const others = existing.filter((milestone) => milestone.id !== id)
  const result = validateMilestoneText(raw, others)
  if (!result.ok) return result

  if (existing.some((milestone) => milestone.id === id && milestone.text === result.text)) {
    return { ok: true, draft }
  }

  return {
    ok: true,
    draft: {
      ...draft,
      milestones: existing.map((milestone) =>
        milestone.id === id ? { ...milestone, text: result.text } : milestone,
      ),
      updatedAt: now,
    },
  }
}

/**
 * Removes a milestone.
 *
 * Removing the LAST one DELETES the key rather than leaving `[]`. That is
 * the whole reason an empty list is not a legal value: `milestones: []`
 * would claim the user had answered this question with nothing, and would
 * pass a step that exists to ask "what would prove you're making progress?".
 *
 * An unknown id is a no-op returning the identical draft, for the reason
 * `deselectGrowthArea` has one: a stale handle cannot invent a change.
 *
 * Note what this deliberately does NOT do, matching ADR 0009: nothing here
 * touches `currentStep`, and nothing anywhere touches milestones when a
 * Growth Area is deselected. `reconcileSelections` is still not extended.
 */
export function removeMilestone(draft: OnboardingDraft, id: string, now: string): OnboardingDraft {
  const existing = draft.milestones ?? []
  if (!existing.some((milestone) => milestone.id === id)) return draft

  const kept = existing.filter((milestone) => milestone.id !== id)

  if (kept.length === 0) {
    const { milestones: _removed, ...rest } = draft
    return { ...rest, updatedAt: now }
  }

  return { ...draft, milestones: kept, updatedAt: now }
}

/** The milestone count, or 0 when the question has not been answered. */
export function milestoneCount(draft: OnboardingDraft): number {
  return draft.milestones?.length ?? 0
}

/**
 * Is the milestone question answered at all?
 *
 * A named predicate for something three places ask: the screen deciding
 * whether to show Continue as enabled, the validator deciding whether the
 * step is satisfied, and a test asserting a fresh draft has not answered
 * it. `MIN_MILESTONES` is 1, so "answered" and "at least one" are the same
 * question today — but they are the same question for a REASON, and a
 * future phase that allows a deliberately empty list would change the
 * answer here rather than in three places.
 */
export function hasAnsweredMilestones(draft: OnboardingDraft): boolean {
  return milestoneCount(draft) >= MIN_MILESTONES
}

/** Mirrors growthAreas.ts so both layers report the same vocabulary. */
export type GrowthAreaProblem = 'empty' | 'too-long' | 'no-words' | 'duplicate' | 'not-found'

/**
 * Moves the draft on to the step after `step`.
 *
 * Returning the draft unchanged for the final step means "no step after
 * this one" is representable without a special case at every call site.
 *
 * This is NAVIGATION. It says where the user is, not whether their
 * answers are any good — see validateOnboardingDraft for that.
 */
export function completeStep(
  draft: OnboardingDraft,
  step: OnboardingStep,
  now: string,
): OnboardingDraft {
  const upcoming = nextStep(step)
  if (!upcoming) return draft

  return { ...draft, currentStep: upcoming, updatedAt: now }
}

/**
 * Where to send someone who reopens the app.
 *
 * This is the ONE and ONLY thing `currentStep` is for. It is deliberately
 * a separate function from the validators so nobody can later reach for
 * `currentStep` when they meant "has this been answered".
 */
export function resumeStep(draft: OnboardingDraft | null): OnboardingStep {
  return draft?.currentStep ?? 'welcome'
}

/**
 * Drops selections that point at nothing.
 *
 * This is the reconciliation rule. Stored data can be older than this
 * build, hand-edited, or written by a future version, so a selected id
 * may name an area that no longer exists. Removing the dangling id is the
 * only safe response: keeping it would make the UI claim the user chose
 * something we cannot show them.
 *
 * Note what it does NOT do: it never touches `customGrowthAreas`, and it
 * never invents a selection. It also cannot lose an answer. `goal` and
 * `why` are not keyed by an id at all (ADR 0010), so no selection change
 * can reach them, and the per-area data that does key on an id arrives in
 * Phase 2C — at which point this function must still be left alone.
 */
export function reconcileSelections(draft: OnboardingDraft): OnboardingDraft {
  const known = new Set(knownGrowthAreas(draft).map((area) => area.id))
  const kept = draft.selectedGrowthAreaIds.filter((id) => known.has(id))

  if (kept.length === draft.selectedGrowthAreaIds.length) return draft

  return { ...draft, selectedGrowthAreaIds: kept }
}

/**
 * Rebuilds a custom area from stored text.
 *
 * Two things are trusted and one is not, and the difference is the whole
 * point of this correction:
 *
 *   name            cleaned, but the user's capitalization is kept.
 *   normalizedName  NEVER trusted. It is recomputed from the name, because
 *                   it is derived data and a stale copy would break
 *                   duplicate detection in a way nothing would catch.
 *   id              trusted when usable, because identity is the one
 *                   thing we must not re-derive. A stored id that is
 *                   missing or blank gets a deterministic one derived
 *                   from the name, so repairing the same draft twice
 *                   produces the same repair.
 *
 * Lenient about the id's shape on purpose: rejecting an id we do not
 * recognise would silently drop a user's area, which is far worse than
 * carrying an id in an unexpected format.
 */
export function normalizeDraftGrowthArea(value: unknown): DraftGrowthArea | null {
  if (typeof value !== 'object' || value === null) return null

  const name = toGrowthAreaDisplayName(String((value as { name?: unknown }).name ?? ''))
  if (name === '') return null

  const normalizedName = normalizeGrowthAreaName(name)
  const storedId = (value as { id?: unknown }).id
  const id =
    typeof storedId === 'string' && storedId.trim() !== ''
      ? storedId.trim()
      : migratedGrowthAreaId(normalizedName)

  return { id, name, normalizedName }
}

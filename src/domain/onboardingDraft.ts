/**
 * The onboarding draft.
 *
 * A draft is a private, resumable, throwaway record of what the user has
 * told us so far. It is NOT a Journey. Nothing here is precious, but it
 * is also not disposable: if the user answered something and we lose it,
 * that is the single most annoying thing this app could do. So the rules
 * below all point the same way.
 *
 * WHY duration / milestones / dailyEffortMinutes ARE ABSENT
 *
 * Those fields belong to Phase 2C. They are deliberately not in the type
 * yet, and the reason is the same one that shaped `goal` and `why`: an
 * optional `milestones?: []` invites an empty list, and an empty list
 * means "answered, and the answer is nothing". A question that has not
 * been asked must not be able to look like a question that was answered
 * badly. They are added when there is a real answer to store.
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
import { toPersonalAnswer } from './personalAnswer'
import type { PersonalAnswer } from './personalAnswer'
import type { GrowthArea } from './growthAreas'

/**
 * Bumped when a stored draft in the OLD format cannot be read correctly by
 * the new build. See onboardingDraftRepository.ts for the migrations that
 * carry older drafts forward.
 *
 *   1  Phase 2A.  Ids WERE normalized names.
 *   2  Ids became opaque, but shared one `ga_` prefix.
 *   3  Ids gained explicit per-origin namespaces: ga_s_ / ga_c_ / ga_m_.
 *
 * WHY ADDING goal AND why DID NOT MAKE IT 4
 *
 * Two reasons, and the second is the one that decided it.
 *
 * The number exists to force a REWRITE, not to count releases. Bumping it
 * would run every existing draft through a migration with nothing to do —
 * there is no old shape to convert, because an absent optional field is
 * exactly what a draft from the previous build already holds, and
 * `normalizeFields` produces it for free.
 *
 * More importantly, `migrateAndNormalizeDraft` treats a HIGHER stored
 * version as "this build is older than the data" and keeps only the fields
 * it understands. So a v4 written by this build, read by the v3 build still
 * in someone's browser cache, would drop the Goal on the next write. Not
 * bumping means that older build loads it as an ordinary v3 draft and
 * ignores a key it has no name for — the same visible outcome, without a
 * version number falsely claiming the two formats are incompatible.
 */
export const ONBOARDING_SCHEMA_VERSION = 3

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

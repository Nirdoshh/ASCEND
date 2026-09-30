/**
 * The onboarding draft.
 *
 * A draft is a private, resumable, throwaway record of what the user has
 * told us so far. It is NOT a Journey. Nothing here is precious, but it
 * is also not disposable: if the user answered something and we lose it,
 * that is the single most annoying thing this app could do. So the rules
 * below all point the same way.
 *
 * WHY goal / why / duration / milestones / dailyEffortMinutes ARE ABSENT
 *
 * Those fields belong to Phases 2B–2C. They are deliberately not in the
 * type yet. An optional `goal?: string` invites `goal: ''`, and an empty
 * string is a lie: it means "answered, and the answer is blank", which is
 * different from "not asked yet". By leaving the fields out entirely, an
 * unanswered question cannot be represented, so no screen can invent a
 * default. They are added in their own slice, when there is a real answer
 * to store.
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
 * are pure projections over exactly one key. Phase 2B's Goal is recorded
 * *against* an area id too, so deselecting in step 2 leaves a Goal
 * written in step 3 untouched and available if the user comes back.
 */

import { MAX_GROWTH_AREA_NAME_LENGTH, mergeGrowthAreas } from './growthAreas'
import { migratedGrowthAreaId } from './growthAreaId'
import { normalizeGrowthAreaName, toGrowthAreaDisplayName } from './growthAreaName'
import type { GrowthArea } from './growthAreas'

/**
 * Bumped when the stored shape changes. See onboardingDraftRepository.ts
 * for the migration that carries v1 drafts forward.
 */
export const ONBOARDING_SCHEMA_VERSION = 2

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
 * never invents a selection. It also cannot lose an answer, because there
 * are no answers in the selection list yet — which is exactly why adding
 * one in Phase 2B must key it by area id.
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

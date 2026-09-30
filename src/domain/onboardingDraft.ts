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
 * type yet. An optional `goal?: string` invites `goal: ''`, and an
 * empty string is a lie: it means "answered, and the answer is blank",
 * which is different from "not asked yet". By leaving the fields out
 * entirely, an unanswered question cannot be represented, so no screen
 * can invent a default and no check has to guess whether a value is
 * real. They are added in their own slice, when there is a real answer
 * to store.
 *
 * WHY SELECTION AND DEFINITION ARE SEPARATE
 *
 *   customGrowthAreas      — areas the user has created. Never removed
 *                            by deselecting.
 *   selectedGrowthAreas    — the ids currently chosen. Only this list
 *                            changes when the user toggles something.
 *
 * This split is the whole "never silently destroy later work" guarantee.
 * Toggling off an area cannot delete the area itself, and it cannot
 * touch any other field of the draft, because the toggle functions
 * below are pure projections over exactly one key. Phase 2B's Goal is
 * recorded *against* an area id, not inside the selection list, so
 * deselecting in step 2 will still leave a Goal written in step 3
 * untouched and available if the user comes back.
 */

import { mergeGrowthAreas, normalizeGrowthAreaName, toGrowthAreaDisplayName } from './growthAreas'
import type { GrowthArea } from './growthAreas'

export const ONBOARDING_SCHEMA_VERSION = 1

/**
 * The full ordered list of onboarding steps.
 *
 * Only the first two are reachable in Phase 2A. The rest are declared
 * because `currentStep` has to be able to name the step the user is on,
 * and because the sequence is a product decision worth writing down
 * once instead of scattering across screens.
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

/** A custom area the user created, stored exactly like a suggested one. */
export interface CustomGrowthArea {
  readonly id: string
  readonly name: string
}

export interface OnboardingDraft {
  readonly schemaVersion: typeof ONBOARDING_SCHEMA_VERSION
  readonly currentStep: OnboardingStep
  /** Ids of chosen areas, in the order they were chosen. */
  readonly selectedGrowthAreas: readonly string[]
  /** Every custom area the user has created, chosen or not. */
  readonly customGrowthAreas: readonly CustomGrowthArea[]
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
    selectedGrowthAreas: [],
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
  return draft.selectedGrowthAreas.includes(id)
}

/**
 * Toggles one area on or off.
 *
 * Three properties this function is written to guarantee, each of which
 * has a test:
 *
 *   1. An unknown id is a NO-OP. A stale link or a tampered store
 *      cannot invent a selection.
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
export function selectGrowthArea(draft: OnboardingDraft, id: string, now: string): OnboardingDraft {
  if (isSelected(draft, id)) return draft
  if (!knownGrowthAreas(draft).some((area) => area.id === id)) return draft

  return {
    ...draft,
    selectedGrowthAreas: [...draft.selectedGrowthAreas, id],
    updatedAt: now,
  }
}

export function deselectGrowthArea(draft: OnboardingDraft, id: string, now: string): OnboardingDraft {
  if (!isSelected(draft, id)) return draft

  return {
    ...draft,
    selectedGrowthAreas: draft.selectedGrowthAreas.filter((selected) => selected !== id),
    updatedAt: now,
  }
}

/**
 * Records a custom area and selects it.
 *
 * Selecting on creation is the friendly reading of intent: nobody types
 * a personal growth area they do not want. It is a single function
 * rather than two so the two facts cannot drift apart — an area cannot
 * be created in a half-applied state.
 *
 * Only `id` and `name` are stored. `kind` is deliberately dropped even
 * though the caller usually holds a full `GrowthArea`: which list an
 * area came from already says what it is, so persisting `kind` would be
 * a second source of truth that could one day contradict the first.
 */
export function addCustomGrowthArea(
  draft: OnboardingDraft,
  area: GrowthArea | CustomGrowthArea,
  now: string,
): OnboardingDraft {
  const stored: CustomGrowthArea = { id: area.id, name: area.name }

  if (draft.customGrowthAreas.some((existing) => existing.id === stored.id)) return draft

  return {
    ...draft,
    customGrowthAreas: [...draft.customGrowthAreas, stored],
    selectedGrowthAreas: isSelected(draft, stored.id)
      ? draft.selectedGrowthAreas
      : [...draft.selectedGrowthAreas, stored.id],
    updatedAt: now,
  }
}

/**
 * Moves the draft on to the step after `step`.
 *
 * Returning the draft unchanged for the final step means "no step after
 * this one" is representable without a special case at every call site.
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
 * Drops selections that point at nothing.
 *
 * This is the reconciliation rule. Stored data can be older than this
 * build, hand-edited, or written by a future version, so a selected id
 * may name an area that no longer exists. Removing the dangling id is
 * the only safe response: keeping it would make the UI claim the user
 * chose something we cannot show them.
 *
 * Note what it does NOT do: it never touches `customGrowthAreas`, and it
 * never invents a selection. It also cannot lose an answer, because
 * there are no answers in the selection list yet — which is exactly why
 * adding one in Phase 2B must keep them keyed by area id.
 */
export function reconcileSelections(draft: OnboardingDraft): OnboardingDraft {
  const known = new Set(knownGrowthAreas(draft).map((area) => area.id))
  const kept = draft.selectedGrowthAreas.filter((id) => known.has(id))

  if (kept.length === draft.selectedGrowthAreas.length) return draft

  return { ...draft, selectedGrowthAreas: kept }
}

/**
 * Rebuilds a custom area from stored text, re-deriving its id.
 *
 * Stored ids are never trusted: the id is a function of the name, so
 * recomputing it heals a record whose id drifted, rather than letting a
 * tampered value create an area the rest of the app cannot recognise.
 * Returns null when the stored text is not usable.
 */
export function normalizeCustomGrowthArea(value: unknown): CustomGrowthArea | null {
  if (typeof value !== 'object' || value === null) return null

  const name = toGrowthAreaDisplayName(String((value as { name?: unknown }).name ?? ''))
  if (name === '') return null

  return { id: normalizeGrowthAreaName(name), name }
}
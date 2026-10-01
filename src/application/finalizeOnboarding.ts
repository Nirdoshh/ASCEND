/**
 * Finalization — the single operation that turns a complete draft into a Journey.
 *
 * This is an APPLICATION SERVICE, not a React component. It owns the rules:
 *   1. Load the draft
 *   2. Validate the COMPLETE draft
 *   3. Refuse invalid drafts
 *   4. Ensure there is no existing active Journey
 *   5. Construct the real Journey
 *   6. Persist the Journey
 *   7. ONLY AFTER successful Journey persistence: remove the OnboardingDraft
 *   8. Report success/failure honestly
 *
 * React must not contain these rules. A component that re-implements them
 * is a second implementation that will drift.
 */

import type { OnboardingDraftRepository } from '../data/repositories/onboardingDraftRepository'
import type { JourneyRepository } from '../data/repositories/journeyRepository'
import type { OnboardingStep } from '../domain/onboardingDraft'
import { createJourneyFromDraft, createJourneyId } from '../domain/journey'
import { knownGrowthAreas } from '../domain/onboardingDraft'
import { validateOnboardingDraft } from '../domain/onboardingValidation'
import type { OnboardingValidation } from '../domain/onboardingValidation'

export type FinalizeResult =
  | { readonly ok: true; readonly journeyId: string }
  | { readonly ok: false; readonly problem: FinalizeProblem; readonly message: string }

export type FinalizeProblem =
  | 'no-draft'
  | 'invalid-draft'
  | 'journey-exists'
  | 'newer-journey-schema'
  | 'storage-unavailable'
  | 'unknown'

/**
 * Creates a Journey from the current OnboardingDraft, if valid and if no
 * active Journey already exists.
 *
 * The order is CRITICAL and matches ADR 0011's lesson:
 *   validate → create → SAVE Journey → THEN clear draft
 *
 * A failed Journey save MUST NOT delete the draft.
 * A failed draft clear MUST NOT leave the user able to create a duplicate.
 */
export async function finalizeOnboarding(
  draftRepository: OnboardingDraftRepository,
  journeyRepository: JourneyRepository,
  now: string = new Date().toISOString(),
): Promise<FinalizeResult> {
  // 1. Load the draft
  const draft = draftRepository.load()
  if (!draft) {
    return { ok: false, problem: 'no-draft', message: 'No onboarding draft to finalize.' }
  }

  // 2. Validate the COMPLETE draft
  const validation = validateOnboardingDraft(draft)
  if (!validation.valid) {
    return { ok: false, problem: 'invalid-draft', message: validation.message }
  }

  // 3. Check for existing active Journey BEFORE constructing the new one
  const existingJourney = journeyRepository.loadActive()
  if (existingJourney) {
    return { ok: false, problem: 'journey-exists', message: 'A Journey already exists.' }
  }

  // 4. Construct the Journey (pure, no side effects)
  const journeyId = createJourneyId()
  const knownAreas = knownGrowthAreas(draft)
  const journey = createJourneyFromDraft(
    {
      selectedGrowthAreaIds: draft.selectedGrowthAreaIds,
      customGrowthAreas: draft.customGrowthAreas,
      goal: draft.goal!,
      why: draft.why!,
      durationDays: draft.durationDays!,
      milestones: draft.milestones!,
      dailyEffortMinutes: draft.dailyEffortMinutes!,
    },
    knownAreas,
    now,
    journeyId,
  )

  // 5. Persist the Journey
  const journeySaveResult = journeyRepository.save(journey)

  if (journeySaveResult === 'newer-schema') {
    return { ok: false, problem: 'newer-journey-schema', message: 'A newer Journey exists.' }
  }
  if (journeySaveResult === 'already-exists') {
    return { ok: false, problem: 'journey-exists', message: 'A Journey already exists.' }
  }
  if (journeySaveResult !== 'ok') {
    // Journey save failed — draft MUST remain intact
    return { ok: false, problem: 'storage-unavailable', message: 'Could not save your Journey. Your answers are safe.' }
  }

  // 6. ONLY AFTER successful Journey persistence: clear the draft
  draftRepository.clear()

  // Note: we do NOT check the clear result here. If clear fails but Journey
  // exists, the user has their Journey and onboarding won't run again because
  // loadActive() will find it. The draft is stale but harmless.

  return { ok: true, journeyId }
}

/**
 * Checks whether onboarding can be finalized right now (without doing it).
 *
 * Useful for showing/hiding the Start Day 1 button, or for a diagnostic.
 */
export function canFinalize(
  draftRepository: OnboardingDraftRepository,
  journeyRepository: JourneyRepository,
): { readonly can: boolean; readonly reason?: string } {
  const draft = draftRepository.load()
  if (!draft) return { can: false, reason: 'no-draft' }

  const validation = validateOnboardingDraft(draft)
  if (!validation.valid) return { can: false, reason: validation.problem }

  const existingJourney = journeyRepository.loadActive()
  if (existingJourney) return { can: false, reason: 'journey-exists' }

  return { can: true }
}

/**
 * Returns the validation details for a complete draft.
 *
 * Used by the Summary screen to show "Some things need your attention"
 * and identify which section(s) are affected.
 */
export function getValidationDetails(draftRepository: OnboardingDraftRepository): OnboardingValidation {
  const draft = draftRepository.load()
  return validateOnboardingDraft(draft)
}

/**
 * Returns the incomplete steps for a draft, in order.
 *
 * Used by the Summary screen to show Edit links for incomplete sections.
 */
export function getIncompleteSteps(
  draftRepository: OnboardingDraftRepository,
): { readonly step: OnboardingStep; readonly problem: string; readonly message: string }[] {
  const draft = draftRepository.load()
  if (!draft) return [{ step: 'welcome', problem: 'not-started', message: 'Onboarding has not been started.' }]

  const validation = validateOnboardingDraft(draft)
  if (validation.valid) return []

  return [{ step: validation.firstIncompleteStep, problem: validation.problem, message: validation.message }]
}
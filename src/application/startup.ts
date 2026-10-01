/**
 * Startup routing decision.
 *
 * This is the single place that decides where a user goes when ASCEND loads.
 * It uses the same repositories and resume logic that onboarding uses, so
 * the rules cannot drift.
 *
 * Kept pure and synchronous so it can be tested without a router, React,
 * or async boundaries. The repositories are synchronous (localStorage),
 * and the resume logic is pure.
 */

import type { OnboardingDraftRepository } from '../data/repositories/onboardingDraftRepository'
import type { JourneyRepository } from '../data/repositories/journeyRepository'
import { resumePath } from '../features/onboarding/resume'

export type StartupDestination =
  | { readonly kind: 'today' }
  | { readonly kind: 'onboarding'; readonly path: string }
  | { readonly kind: 'onboarding-resume'; readonly path: string }

/**
 * Resolves the startup destination for a cold load or refresh of `/`.
 *
 * CASE 1 — active Journey exists
 *   → { kind: 'today' }
 *
 * CASE 2 — no Journey, onboarding draft exists
 *   → { kind: 'onboarding-resume', path: resumePath(draft) }
 *   Uses the existing onboarding resume/domain logic.
 *
 * CASE 3 — no Journey and no onboarding draft
 *   → { kind: 'onboarding', path: '/onboarding' }
 *
 * @param journeyRepository - Repository to check for active Journey
 * @param draftRepository - Repository to check for onboarding draft
 * @returns The destination to navigate to
 */
export function resolveStartupDestination(
  journeyRepository: JourneyRepository,
  draftRepository: OnboardingDraftRepository,
): StartupDestination {
  // Check for active Journey first — this is the primary gate
  const activeJourney = journeyRepository.loadActive()
  if (activeJourney) {
    return { kind: 'today' }
  }

  // No active Journey: check for onboarding draft
  const draft = draftRepository.load()
  if (draft) {
    // Draft exists: resume at the correct step using existing logic
    return { kind: 'onboarding-resume', path: resumePath(draft) }
  }

  // No Journey, no draft: fresh user starts onboarding
  return { kind: 'onboarding', path: '/onboarding' }
}

/**
 * Resolves the destination for direct access to `/today`.
 *
 * If there is NO active Journey:
 *   → redirect into onboarding/resume (same logic as `/`)
 *
 * If there IS an active Journey:
 *   → { kind: 'today' } (normal access)
 *
 * @param journeyRepository - Repository to check for active Journey
 * @param draftRepository - Repository to check for onboarding draft
 * @returns The destination to navigate to
 */
export function resolveTodayDestination(
  journeyRepository: JourneyRepository,
  draftRepository: OnboardingDraftRepository,
): StartupDestination {
  const activeJourney = journeyRepository.loadActive()
  if (activeJourney) {
    return { kind: 'today' }
  }

  // No active Journey: same logic as root
  const draft = draftRepository.load()
  if (draft) {
    return { kind: 'onboarding-resume', path: resumePath(draft) }
  }

  return { kind: 'onboarding', path: '/onboarding' }
}
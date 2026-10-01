/**
 * Default repository instances.
 *
 * This module provides the one-line seam for swapping storage backends.
 * In Phase 11, replace these factories with ones that talk to the Worker API
 * and no screen changes are required.
 */

import { createOnboardingDraftRepository } from './onboardingDraftRepository'
import type { OnboardingDraftRepository } from './onboardingDraftRepository'
import { createJourneyRepository } from './journeyRepository'
import type { JourneyRepository } from './journeyRepository'
import { createDailyPlanRepository } from './dailyPlanRepository'
import type { DailyPlanRepository } from './dailyPlanRepository'
import { createWebStorageStore } from '../storage'

/**
 * The repository onboarding uses by default.
 */
export const defaultOnboardingDraftRepository: OnboardingDraftRepository =
  createOnboardingDraftRepository(createWebStorageStore())

/**
 * The Journey repository onboarding uses by default.
 */
export const defaultJourneyRepository: JourneyRepository =
  createJourneyRepository(createWebStorageStore())

/**
 * The Daily Plan repository used by the Today screen.
 */
export const defaultDailyPlanRepository: DailyPlanRepository =
  createDailyPlanRepository(createWebStorageStore())
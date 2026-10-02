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
import { createTodayWinRepository } from './todayWinRepository'
import type { TodayWinRepository } from './todayWinRepository'
import { createDailyStepsRepository } from './dailyStepsRepository'
import type { DailyStepsRepository } from './dailyStepsRepository'
import { createWebStorageStore } from '../storage'
import { createSystemRepository } from './systemRepository'
import type { SystemRepository } from './systemRepository'

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

/**
 * The Today's Win repository used by the Today screen.
 */
export const defaultTodayWinRepository: TodayWinRepository =
  createTodayWinRepository(createWebStorageStore())

/**
 * The Daily Steps repository used by the Today screen.
 */
export const defaultDailyStepsRepository: DailyStepsRepository =
  createDailyStepsRepository(createWebStorageStore())

export const defaultSystemRepository: SystemRepository =
  createSystemRepository(createWebStorageStore())

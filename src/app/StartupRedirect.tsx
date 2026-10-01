import { Navigate, useLoaderData } from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { ASCEND_JOURNEY_KEY, ASCEND_ONBOARDING_DRAFT_KEY } from '../data/storage/keys'
import { normalizeJourney, hasNewerJourneySchema } from '../domain/journey'
import { migrateAndNormalizeDraft } from '../data/repositories/onboardingDraftRepository'
import { resolveStartupDestination, resolveTodayDestination } from '../application/startup'
import type { JourneyRepository } from '../data/repositories/journeyRepository'
import type { OnboardingDraftRepository } from '../data/repositories/onboardingDraftRepository'

/**
 * Loader data for the startup redirect.
 */
type StartupLoaderData = {
  readonly destination: ReturnType<typeof resolveStartupDestination>
}

/**
 * Reads the active journey directly from localStorage.
 * This bypasses the repository abstraction to avoid store initialization issues
 * during router loader execution in test environments.
 */
function loadActiveJourneyDirect(): ReturnType<typeof normalizeJourney> {
  try {
    const raw = window.localStorage.getItem(ASCEND_JOURNEY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (hasNewerJourneySchema(parsed)) return null
    return normalizeJourney(parsed, new Date().toISOString())
  } catch {
    return null
  }
}

/**
 * Reads the onboarding draft directly from localStorage.
 * This bypasses the repository abstraction to avoid store initialization issues
 * during router loader execution in test environments.
 */
function loadOnboardingDraftDirect(): ReturnType<typeof migrateAndNormalizeDraft> {
  try {
    const raw = window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)
    return migrateAndNormalizeDraft(raw)
  } catch {
    return null
  }
}

/**
 * Creates a minimal JourneyRepository that only implements loadActive.
 * This is used by the startup loaders to check for an active journey.
 */
function createJourneyCheckRepository(): JourneyRepository {
  return {
    loadActive: loadActiveJourneyDirect,
    save: () => 'unavailable' as const,
    clear: () => {},
    isAvailable: () => true,
  }
}

/**
 * Creates a minimal OnboardingDraftRepository that only implements load.
 * This is used by the startup loaders to check for an onboarding draft.
 */
function createDraftCheckRepository(): OnboardingDraftRepository {
  return {
    load: loadOnboardingDraftDirect,
    save: () => 'unavailable' as const,
    clear: () => {},
    isAvailable: () => true,
  }
}

/**
 * Loader for the root route (`/`).
 *
 * Runs synchronously on every cold load and refresh of `/`.
 * Decides where the user should go based on stored data.
 */
export function rootLoader(): StartupLoaderData {
  return {
    destination: resolveStartupDestination(
      createJourneyCheckRepository(),
      createDraftCheckRepository(),
    ),
  }
}

/**
 * Loader for the `/today` route.
 *
 * Runs synchronously on every cold load and refresh of `/today`.
 * Redirects to onboarding if no active Journey exists.
 */
export function todayLoader(): StartupLoaderData {
  return {
    destination: resolveTodayDestination(
      createJourneyCheckRepository(),
      createDraftCheckRepository(),
    ),
  }
}

const TodayScreen = lazy(() => import('../features/today/TodayScreen').then((m) => ({ default: m.TodayScreen })))

/**
 * Root route element (AppShell's index child).
 *
 * Reads the loader decision and either renders TodayScreen (if Journey exists)
 * or redirects to onboarding.
 */
export function RootRedirect() {
  const { destination } = useLoaderData<StartupLoaderData>()

  switch (destination.kind) {
    case 'today':
      return (
        <Suspense fallback={null}>
          <TodayScreen />
        </Suspense>
      )
    case 'onboarding':
    case 'onboarding-resume':
      return <Navigate to={destination.path} replace />
  }
}

/**
 * Today route element (top-level /today route).
 *
 * Reads the loader decision and either redirects to / (AppShell's index)
 * or redirects to onboarding.
 */
export function TodayRedirect() {
  const { destination } = useLoaderData<StartupLoaderData>()

  switch (destination.kind) {
    case 'today':
      return <Navigate to="/" replace />
    case 'onboarding':
    case 'onboarding-resume':
      return <Navigate to={destination.path} replace />
  }
}
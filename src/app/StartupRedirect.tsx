import { Navigate, useLoaderData } from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { AppShell } from './AppShell'
import { TodayLoading } from '../features/today/TodayLoading'

import { createJourneyRepository } from '../data/repositories/journeyRepository'
import { createOnboardingDraftRepository } from '../data/repositories/onboardingDraftRepository'
import { createWebStorageStore } from '../data/storage'
import { resolveStartupDestination, resolveTodayDestination } from '../application/startup'

/**
 * Loader data for the startup redirect.
 */
type StartupLoaderData = {
  readonly destination: ReturnType<typeof resolveStartupDestination>
}

/**
 * Creates a JourneyRepository using the real Web Storage store.
 * This is used by route loaders to check for an active journey.
 */
function createJourneyCheckRepository() {
  return createJourneyRepository(createWebStorageStore())
}

/**
 * Creates an OnboardingDraftRepository using the real Web Storage store.
 * This is used by route loaders to check for an onboarding draft.
 */
function createDraftCheckRepository() {
  return createOnboardingDraftRepository(createWebStorageStore())
}

/**
 * Loader for the root route (`/`).
 *
 * Runs synchronously on every cold load and refresh of `/`.
 * Redirects to /today if Journey exists, otherwise to onboarding.
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
 * If Journey exists, allows access (renders TodayScreen in AppShell).
 * Otherwise redirects to onboarding/resume.
 */
export function todayLoader(): StartupLoaderData {
  const journeyRepo = createJourneyCheckRepository()
  const draftRepo = createDraftCheckRepository()
  return {
    destination: resolveTodayDestination(journeyRepo, draftRepo),
  }
}

/**
 * Loader for protected AppShell routes (journey, progress, you).
 *
 * If no active Journey, redirects to onboarding/resume.
 * If Journey exists, allows access.
 */
export function appShellRouteLoader(): StartupLoaderData {
  return {
    destination: resolveTodayDestination(
      createJourneyCheckRepository(),
      createDraftCheckRepository(),
    ),
  }
}

const TodayScreen = lazy(() => import('../features/today/TodayScreen').then((m) => ({ default: m.TodayScreen })))

/**
 * Root route element (`/`).
 *
 * Reads the loader decision and either redirects to /today (if Journey exists)
 * or redirects to onboarding.
 */
export function RootRedirect() {
  const { destination } = useLoaderData<StartupLoaderData>()

  switch (destination.kind) {
    case 'today':
      return <Navigate to="/today" replace />
    case 'onboarding':
    case 'onboarding-resume':
      return <Navigate to={destination.path} replace />
  }
}

/**
 * Today route element (`/today`).
 *
 * If Journey exists, renders TodayScreen (via Suspense for lazy load).
 * If no Journey, redirects to onboarding/resume.
 */
export function TodayRedirect() {
  const { destination } = useLoaderData<StartupLoaderData>()

  switch (destination.kind) {
    case 'today':
      return (
        <AppShell>
          <Suspense fallback={<TodayLoading />}>
            <TodayScreen />
          </Suspense>
        </AppShell>
      )
    case 'onboarding':
    case 'onboarding-resume':
      return <Navigate to={destination.path} replace />
  }
}

/**
 * AppShell route guard element.
 *
 * Protects all child routes of AppShell (today, journey, progress, you).
 * If no active Journey, redirects to onboarding/resume.
 * If Journey exists, renders AppShell (which contains an Outlet for child routes).
 */
export function AppShellGuard() {
  const { destination } = useLoaderData<StartupLoaderData>()

  switch (destination.kind) {
    case 'today':
      // Journey exists - render AppShell (which contains its own Outlet)
      return <AppShell />
    case 'onboarding':
    case 'onboarding-resume':
      return <Navigate to={destination.path} replace />
  }
}

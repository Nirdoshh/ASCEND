import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from './AppShell'
import { DesignSystemScreen } from '../features/designsystem/DesignSystemScreen'
import { DurationScreen } from '../features/onboarding/DurationScreen'
import { EffortScreen } from '../features/onboarding/EffortScreen'
import { GoalScreen } from '../features/onboarding/GoalScreen'
import { GrowthAreasScreen } from '../features/onboarding/GrowthAreasScreen'
import { MilestonesScreen } from '../features/onboarding/MilestonesScreen'
import { OnboardingLayout } from '../features/onboarding/OnboardingLayout'
import { SummaryScreen } from '../features/onboarding/SummaryScreen'
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen'
import { WhyScreen } from '../features/onboarding/WhyScreen'
import { JourneyScreen } from '../features/journey/JourneyScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { YouScreen } from '../features/you/YouScreen'
import { NotFoundScreen } from '../features/notfound/NotFoundScreen'
import { rootLoader, todayLoader, RootRedirect, TodayRedirect } from './StartupRedirect'

/**
 * Routing.
 *
 * The AppShell route owns the header and navigation. Its index child (/)
 * runs a startup loader to decide whether to show Today or redirect to
 * onboarding. The /today route has its own loader for direct access.
 *
 * Onboarding is a SIBLING of AppShell, not a child of it. Someone who has
 * not picked a Growth Area has no Journey yet, so the four-screen
 * navigation would be four empty screens promising things that do not exist.
 *
 * `not_found_handling: "single-page-application"` in wrangler.jsonc makes
 * a deep link to /journey reach this client router on a cold load.
 */
export const router = createBrowserRouter([
  /*
   * Main application shell — the root layout.
   *
   * Its index child (/) runs the startup loader to decide the destination.
   */
  {
    path: '/',
    element: <AppShell />,
    children: [
      /*
       * Index route: decides where a user landing on / should go.
       *
       * The loader runs synchronously on every cold load and refresh.
       * The element performs the redirect based on the loader's decision.
       */
      { index: true, loader: rootLoader, element: <RootRedirect /> },

      { path: 'journey', element: <JourneyScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'you', element: <YouScreen /> },

      /*
       * Not in the main navigation on purpose. Reachable by URL for
       * design review; see the note in DesignSystemScreen.
       */
      { path: 'design-system', element: <DesignSystemScreen /> },

      /*
       * Alias for /today — redirects to the index route.
       * This is a child of AppShell so it renders inside the shell.
       */
      { path: 'today', element: <Navigate to="/" replace /> },

      { path: '*', element: <NotFoundScreen /> },
    ],
  },

  /*
   * /today route: decides whether direct access to /today is allowed.
   *
   * If an active Journey exists, redirects to / (which renders TodayScreen
   * inside AppShell). If not, redirects to onboarding/resume.
   *
   * This is a TOP-LEVEL route (sibling of AppShell) so it can run its
   * loader before entering the shell.
   */
  {
    path: '/today',
    loader: todayLoader,
    element: <TodayRedirect />,
  },

  /*
   * Onboarding is a SIBLING of the main shell, not a child of it.
   *
   * Both reasons in one line: someone who has not picked a Growth Area
   * has no Journey yet, so the four-screen navigation would be four
   * empty screens promising things that do not exist. And the draft
   * provider has to sit above both onboarding steps so navigating
   * between them keeps one draft in memory rather than reloading from
   * storage on every step.
   *
   * Each onboarding step is its own URL. That is what makes the browser
   * back button, forward button and refresh work with no extra code:
   * the URL is the step.
   *
   * These paths are mirrored in features/onboarding/resume.ts, which owns
   * the step-to-URL table a returning visitor is sent through. The route
   * smoke test in routes.test.tsx cold-loads every one of them, so the two
   * cannot drift apart without a test failing.
   */
  {
    path: '/onboarding',
    element: <OnboardingLayout />,
    children: [
      { index: true, element: <WelcomeScreen /> },
      { path: 'areas', element: <GrowthAreasScreen /> },
      { path: 'goal', element: <GoalScreen /> },
      { path: 'why', element: <WhyScreen /> },
      /*
       * The step id and the URL deliberately disagree at the end:
       * `daily-effort` is served at `/onboarding/effort`. The mapping is
       * explicit in resume.ts, which explains why it is not derived from the
       * step name — a derivation would have produced a worse address bar, and
       * renaming the STEP to fix that would rewrite the stored `currentStep`
       * of every draft already on disk.
       */
      { path: 'duration', element: <DurationScreen /> },
      { path: 'milestones', element: <MilestonesScreen /> },
      { path: 'effort', element: <EffortScreen /> },
      { path: 'summary', element: <SummaryScreen /> },
    ],
  },
])
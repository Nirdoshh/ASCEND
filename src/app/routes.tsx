import { createBrowserRouter } from 'react-router-dom'

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
import { SystemScreen } from '../features/system/SystemScreen'
import {
  rootLoader,
  todayLoader,
  appShellRouteLoader,
  RootRedirect,
  TodayRedirect,
  AppShellGuard,
} from './StartupRedirect'

/**
 * Routing.
 *
 * The routing hierarchy:
 *
 * 1. Root route (/) - decides whether to go to /today or /onboarding
 * 2. /today route (TOP-LEVEL) - runs loader to check for Journey, renders TodayRedirect
 * 3. AppShell with guard - protects journey, progress, you routes
 * 4. Onboarding - sibling of AppShell, always accessible
 *
 * The /today route MUST come before AppShell so that direct navigation
 * to /today runs its loader before the AppShell layout route matches.
 *
 * `not_found_handling: "single-page-application"` in wrangler.jsonc makes
 * a deep link to /journey reach this client router on a cold load.
 */
export const router = createBrowserRouter([
  /*
   * Root route: decides where a user landing on / should go.
   *
   * Redirects to /today if Journey exists, otherwise to /onboarding.
   */
  {
    path: '/',
    loader: rootLoader,
    element: <RootRedirect />,
  },

  /*
   * /today route (TOP-LEVEL): handles direct access to /today.
   *
   * Runs its own loader (todayLoader) to check for Journey.
   * If Journey exists, renders TodayRedirect which shows TodayScreen.
   * If no Journey, redirects to onboarding/resume.
   *
   * This MUST come before AppShell so that direct navigation to /today
   * runs its loader before the AppShell layout route matches.
   */
  {
    path: '/today',
    loader: todayLoader,
    element: <TodayRedirect />,
  },

  /*
   * ASCEND SYSTEM is an isolated prototype surface. It intentionally sits
   * outside the guarded production shell: sample fixtures only, no Journey
   * requirement, and no access to the existing persistence contracts.
   */
  {
    path: '/system',
    element: <SystemScreen />,
  },

  /*
   * Main application shell with route guard.
   *
   * The loader checks for active Journey. If none exists, redirects to
   * onboarding/resume. The AppShellGuard element either renders AppShell
   * with the child outlet (Journey exists) or redirects (no Journey).
   *
   * This single guard protects all child routes: journey, progress, you.
   */
  {
    loader: appShellRouteLoader,
    // AppShellGuard is the direct element, so it has access to loader data
    // It renders AppShell with an Outlet inside for child routes
    element: <AppShellGuard />,
    children: [
      { path: 'journey', element: <JourneyScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'you', element: <YouScreen /> },

      /*
       * Not in the main navigation on purpose. Reachable by URL for
       * design review; see the note in DesignSystemScreen.
       */
      { path: 'design-system', element: <DesignSystemScreen /> },

      { path: '*', element: <NotFoundScreen /> },
    ],
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

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
import { TodayScreen } from '../features/today/TodayScreen'
import { YouScreen } from '../features/you/YouScreen'
import { NotFoundScreen } from '../features/notfound/NotFoundScreen'

/**
 * Routing.
 *
 * One layout route (AppShell) owns the header and the navigation; the
 * four product screens are its children. That is the whole hierarchy,
 * and it maps one-to-one onto the approved information architecture.
 *
 * Why a router at all, with only four screens: because a browser URL
 * is the cheapest state container we own. It survives refresh, it works
 * with the back button, it can be linked to, and it costs no
 * application state. Those are properties we would otherwise hand-roll
 * badly.
 *
 * `not_found_handling: "single-page-application"` in wrangler.jsonc
 * makes a deep link to /journey reach this client router on a cold
 * load, which is why a production deploy does not 404 on refresh.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'journey', element: <JourneyScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'you', element: <YouScreen /> },

      /*
       * Not in the main navigation on purpose. Reachable by URL for
       * design review; see the note in DesignSystemScreen.
       */
      { path: 'design-system', element: <DesignSystemScreen /> },

      /*
       * Aliases we will want in Phase 2+ but do not need yet. Kept as a
       * redirect rather than a duplicate screen so there is exactly one
       * source of truth for each route.
       */
      { path: 'today', element: <Navigate to="/" replace /> },

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
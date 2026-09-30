import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from './AppShell'
import { DesignSystemScreen } from '../features/designsystem/DesignSystemScreen'
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
])

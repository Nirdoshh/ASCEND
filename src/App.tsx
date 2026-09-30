import { RouterProvider } from 'react-router-dom'

import { BootErrorBoundary } from './app/BootErrorBoundary'
import { PreferencesProvider } from './app/PreferencesProvider'
import { router } from './app/routes'

/**
 * ASCEND root.
 *
 * Composition order is the whole architecture in three lines:
 *
 *   BootErrorBoundary   catches a failure to start at all
 *     PreferencesProvider  makes the saved preferences available
 *       RouterProvider      owns the URL, and therefore the navigation
 *
 * Two rules govern this file, and both were learned the hard way:
 *
 * 1. Nothing above `RouterProvider` may read router context.
 *    `RouterProvider` is what creates it, so a component rendered above
 *    it — including one in this file — has no router. `RouteErrorBoundary`
 *    calls `useLocation()` to decide when to clear a previous error, and
 *    mounted here it threw "useLocation() may be used only in the context
 *    of a <Router> component" and took the whole app down on first paint.
 *    That is why no boundary below may depend on the router either.
 *
 * 2. Something must still catch a boot failure. Because
 *    `RouterProvider` renders no children of its own, nothing inside the
 *    router can catch a failure to *reach* the router. `BootErrorBoundary`
 *    sits above everything for that reason, and it deliberately uses no
 *    router hooks of its own.
 *
 * Error containment for the running app lives inside the router instead:
 * AppShell renders RouteErrorBoundary around the header, the nav and the
 * route outlet, so every route — including the not-found screen — is
 * covered.
 *
 * No business logic lives in this file, and none should ever.
 */
export function App() {
  return (
    <BootErrorBoundary>
      <PreferencesProvider>
        <RouterProvider router={router} />
      </PreferencesProvider>
    </BootErrorBoundary>
  )
}
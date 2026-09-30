import { RouterProvider } from 'react-router-dom'

import { PreferencesProvider } from './app/PreferencesProvider'
import { router } from './app/routes'

/**
 * ASCEND root.
 *
 * Composition order is the whole architecture in two lines:
 *
 *   PreferencesProvider  makes the saved preferences available
 *     RouterProvider      owns the URL, and therefore the navigation
 *
 * There is deliberately no error boundary here. `RouterProvider` is what
 * creates the router context, so anything rendered above it has no
 * router to read — and `RouteErrorBoundary` calls `useLocation()` to
 * decide when to clear a previous error. Mounted here it would throw
 * "useLocation() may be used only in the context of a <Router> component"
 * and take the whole app down on the first paint.
 *
 * Error containment lives inside the router instead: AppShell renders
 * RouteErrorBoundary around the header, the nav and the route outlet, so
 * every route — including the not-found screen — is covered, and the
 * boundary can use router context legitimately.
 *
 * No business logic lives in this file, and none should ever.
 */
export function App() {
  return (
    <PreferencesProvider>
      <RouterProvider router={router} />
    </PreferencesProvider>
  )
}

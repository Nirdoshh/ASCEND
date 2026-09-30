import { RouterProvider } from 'react-router-dom'

import { PreferencesProvider } from './app/PreferencesProvider'
import { RouteErrorBoundary } from './app/RouteErrorBoundary'
import { router } from './app/routes'

/**
 * ASCEND root.
 *
 * Composition order is the whole architecture in three lines:
 *
 *   ErrorBoundary        catches anything below from crashing the app
 *     PreferencesProvider  makes the saved preferences available
 *       RouterProvider      owns the URL, and therefore the navigation
 *
 * No business logic lives in this file, and none should ever.
 */
export function App() {
  return (
    <RouteErrorBoundary>
      <PreferencesProvider>
        <RouterProvider router={router} />
      </PreferencesProvider>
    </RouteErrorBoundary>
  )
}

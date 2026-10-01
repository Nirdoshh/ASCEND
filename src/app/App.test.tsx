import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from '../App'

/**
 * The composition test.
 *
 * This renders the real App, with the real router and the real screens.
 * That is deliberate: the Phase 1 crash was not a logic bug, it was a
 * component-tree bug. `RouteErrorBoundary` called `useLocation()` while
 * being mounted above `RouterProvider`, so it threw "useLocation() may be
 * used only in the context of a <Router> component" on the very first
 * paint — in a browser, not in any test, because every other test wrapped
 * the component under test in `MemoryRouter` itself and therefore supplied
 * the context the app was missing.
 *
 * Rendering the root with no router wrapper of our own is what turns
 * "some component needs router context" into a failing assertion instead
 * of a blank page.
 *
 * Note: The routing behavior (redirect to onboarding when no journey exists)
 * is tested in `routes.test.tsx` and `startup.test.ts`. This test only
 * verifies the App component tree renders without router context errors.
 */
describe('App', () => {
  it('renders without an unhandled router-context error', () => {
    expect(() => render(<App />)).not.toThrow()
  })

  it('renders the onboarding screen at the default route when no journey exists', () => {
    render(<App />)

    // With no journey and no draft, the startup loader redirects to onboarding
    expect(screen.getByRole('heading', { name: 'Become the person you want to be.', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('navigates between onboarding routes through the real router', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /start my journey/i }))

    expect(screen.getByRole('heading', { name: 'What do you want to improve?', level: 1 })).toBeInTheDocument()
  })
})
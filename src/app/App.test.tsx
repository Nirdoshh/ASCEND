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
 */
describe('App', () => {
  it('renders without an unhandled router-context error', () => {
    expect(() => render(<App />)).not.toThrow()
  })

  it('renders the shell and the Today screen at the default route', () => {
    render(<App />)

    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Today', level: 1 })).toBeInTheDocument()
  })

  it('navigates between routes through the real router', async () => {
    // The router is created at module load and captures the location then,
    // so pushState afterwards cannot move it. Clicking the nav is the
    // honest way to exercise the real router's navigation.
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: /journey/i }))

    expect(screen.getByRole('heading', { name: 'Journey', level: 1 })).toBeInTheDocument()
  })
})
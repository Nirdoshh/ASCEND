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
 * The release root opens System. Legacy startup routing is still covered by
 * `routes.test.tsx` and `startup.test.ts` independently of this composition.
 */
describe('App', () => {
  it('renders without an unhandled router-context error', () => {
    expect(() => render(<App />)).not.toThrow()
  })

  it('renders System at the default route without a Journey', () => {
    render(<App />)

    // The release entry is independent of legacy Journey data.
    expect(screen.getByRole('heading', { name: 'Become visible to yourself.', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter the System/i })).toBeInTheDocument()
  })

  it('enters System through the real root router', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Enter the System/i }))

    expect(screen.getByRole('heading', { name: 'Today', level: 1 })).toBeInTheDocument()
  })
})

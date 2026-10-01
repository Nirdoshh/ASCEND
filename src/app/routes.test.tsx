import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Route smoke test.
 *
 * Every URL ASCEND ships is loaded at a real location, through the real
 * router, with no router wrapper supplied by the test. That is the part
 * that matters: a component tree can be perfectly correct per-file and
 * still throw the moment the app owns its own Router (Phase 1's
 * `useLocation()` outside `<Router>` crash). Asserting that each route
 * renders a heading from a real navigation is what proves the URLs work,
 * not just that the dev server returns 200 for all of them — which it
 * does even when the app renders nothing at all.
 *
 * The router is created when `app/routes` is first evaluated and captures
 * `window.location` at that moment, so each case resets modules, sets the
 * URL, then imports `App` fresh.
 */
afterEach(() => {
  cleanup()
  vi.resetModules()
})

async function renderAt(path: string) {
  window.history.replaceState({}, '', path)
  const { App } = await import('../App')
  return render(<App />)
}

describe('routes', () => {
  const cases = [
    { path: '/', heading: 'Today' },
    // "/today" is a deliberate alias that redirects to the index route.
    { path: '/today', heading: 'Today' },
    { path: '/journey', heading: 'Journey' },
    { path: '/progress', heading: 'Progress' },
    { path: '/you', heading: 'You' },
    { path: '/design-system', heading: 'Design system' },
    { path: '/nowhere-at-all', heading: /not found/i },

    /*
     * Onboarding is registered as a sibling of the main shell, not a
     * child of it, so these two prove that wiring specifically. They
     * also cover the case that broke in production in Phase 1: a cold
     * load of a nested client route with no draft stored at all, which
     * must render a usable screen rather than a blank page.
     */
    { path: '/onboarding', heading: 'Become the person you want to be.' },
    { path: '/onboarding/areas', heading: 'What do you want to improve?' },
    // The two Phase 2B URLs. A cold load of either must render the
    // question, because somebody can bookmark, refresh or share them —
    // and a route that only works when reached by clicking is not a route.
    { path: '/onboarding/goal', heading: 'What would you love to achieve?' },
    { path: '/onboarding/why', heading: 'Why does this matter to you?' },
  ] as const

  for (const { path, heading } of cases) {
    it(`renders ${path}`, async () => {
      await renderAt(path)

      expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
    })
  }

  it('renders inside the error boundary, not outside it', async () => {
    // The boundary covers the header, the nav and the outlet, so a working
    // route must still show navigation. If RouteErrorBoundary were mounted
    // above RouterProvider again, these assertions would never be reached.
    await renderAt('/journey')

    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
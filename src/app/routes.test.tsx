import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { progressJourney } from '../test/progressFixtures'
import { ASCEND_JOURNEY_KEY } from '../data/storage/keys'
import { dailyPlanStorageKey } from '../domain/dailyPlan'
import { todayWinStorageKey } from '../domain/todayWin'
import { dailyStepsStorageKey } from '../domain/dailyStep'

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
 *
 * Root opens System independently of legacy data. The legacy /today route
 * still redirects to /onboarding when no Journey or draft is present.
 *
 * Protected app routes (/journey, /progress, /you, /design-system) also
 * redirect to /onboarding when no active Journey exists.
 */
beforeEach(() => {
  window.localStorage.clear()
})

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
  it.each(['/', '/system'])('opens %s while preserving all legacy user data', async path => {
    const legacy = {
      [ASCEND_JOURNEY_KEY]: JSON.stringify(progressJourney()),
      [dailyPlanStorageKey(progressJourney().id, '2026-10-02')]: 'saved plan bytes',
      [todayWinStorageKey('dp_legacy')]: 'saved win bytes',
      [dailyStepsStorageKey('dp_legacy')]: 'saved step bytes',
    }
    for (const [key, bytes] of Object.entries(legacy)) window.localStorage.setItem(key, bytes)
    await renderAt(path)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Enter the System' }))
    await screen.findByRole('heading', { name: 'Today', level: 1 })
    expect(window.location.pathname).toBe(path)
    for (const [key, bytes] of Object.entries(legacy)) expect(window.localStorage.getItem(key)).toBe(bytes)
  })

  it('keeps Today in the shared shell and supports keyboard navigation to Progress and back', async () => {
    window.localStorage.setItem(ASCEND_JOURNEY_KEY, JSON.stringify(progressJourney()))
    await renderAt('/today')
    await screen.findByRole('heading', { name: 'Today', level: 1 })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Today/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main')
    const user = userEvent.setup()
    screen.getByRole('link', { name: /^Progress/ }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Progress', level: 1 })
    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
    expect(screen.getByRole('link', { name: /^Progress/ })).toHaveAttribute('aria-current', 'page')
    screen.getByRole('link', { name: /^Today/ }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Today', level: 1 })
    expect(screen.getByRole('link', { name: /^Today/ })).toHaveAttribute('aria-current', 'page')
  })

  it('cold-loads Progress for an active Journey without creating a plan', async () => {
    window.localStorage.setItem(ASCEND_JOURNEY_KEY, JSON.stringify(progressJourney()))
    await renderAt('/progress')
    await screen.findByRole('heading', { name: 'Progress', level: 1 })
    expect(screen.getByText('No completed actions yet')).toBeInTheDocument()
    expect(Object.keys(window.localStorage).filter(key => key.startsWith('ascend:daily-plan:'))).toEqual([])
  })

  const cases = [
    /*
     * Root opens System; /today retains legacy startup routing.
     */
    { path: '/', heading: 'Become visible to yourself.' },
    { path: '/today', heading: 'Become the person you want to be.' },

    /*
     * Protected app routes redirect to onboarding when no Journey exists.
     * The AppShell guard intercepts and redirects before rendering the shell.
     */
    { path: '/journey', heading: 'Become the person you want to be.' },
    { path: '/progress', heading: 'Become the person you want to be.' },
    { path: '/you', heading: 'Become the person you want to be.' },
    { path: '/design-system', heading: 'Become the person you want to be.' },

    /*
     * Not found renders the NotFoundScreen (still goes through AppShell guard,
     * so also redirects to onboarding when no Journey).
     */
    { path: '/nowhere-at-all', heading: 'Become the person you want to be.' },

    /*
     * Onboarding is registered as a sibling of the main shell, not a
     * child of it, so these prove that wiring specifically. They also
     * cover the case that broke in production in Phase 1: a cold load
     * of a nested client route with no draft stored at all, which must
     * render a usable screen rather than a blank page.
     */
    { path: '/onboarding', heading: 'Become the person you want to be.' },
    { path: '/onboarding/areas', heading: 'What do you want to improve?' },
    // The Phase 2B and 2C URLs. A cold load of any of them must render the
    // question, because somebody can bookmark, refresh or share them — and
    // a route that only works when reached by clicking is not a route.
    { path: '/onboarding/goal', heading: 'What would you love to achieve?' },
    { path: '/onboarding/why', heading: 'Why does this matter to you?' },
    { path: '/onboarding/duration', heading: 'How long do you want to work toward this?' },
    { path: '/onboarding/milestones', heading: 'What would prove you’re making progress?' },
    {
      path: '/onboarding/effort',
      heading: 'How much time can you realistically give this each day?',
    },
    { path: '/onboarding/summary', heading: 'Your Journey' },
  ] as const

  for (const { path, heading } of cases) {
    it(`renders ${path}`, async () => {
      await renderAt(path)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
      })
    })
  }

  it('renders inside the error boundary, not outside it', async () => {
    // The boundary covers the header, the nav and the outlet, so a working
    // route must still show navigation. If RouteErrorBoundary were mounted
    // above RouterProvider again, these assertions would never be reached.
    // For onboarding routes, the boundary is part of OnboardingLayout.
    await renderAt('/onboarding')

    expect(screen.getByRole('heading', { name: 'Become the person you want to be.', level: 1 })).toBeInTheDocument()
  })

  it('keeps /system available outside Journey startup routing', async () => {
    await renderAt('/system')

    expect(await screen.findByRole('heading', { name: /Become visible to yourself/ })).toBeInTheDocument()
    expect(screen.getByText('Paths, Goals, and Roadmaps / saved locally')).toBeInTheDocument()
  })
})

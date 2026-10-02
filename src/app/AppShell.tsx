import { Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AppHeader } from '../components/layout/AppHeader'
import { PrimaryNav } from '../components/layout/PrimaryNav'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import './AppShell.css'

/**
 * The application shell.
 *
 * Three regions, in this order, for three reasons:
 *
 *  1. SKIP LINK — a keyboard user should reach their plan in one Tab
 *     press instead of tabbing through the header and the nav every
 *     time (WCAG 2.4.1, Bypass Blocks).
 *
 *  2. HEADER then NAV then MAIN — matches the visual order, so the
 *     reading order and the focus order agree. When they disagree,
 *     keyboard and screen-reader users get a different app.
 *
 *  3. MAIN carries the landmark role and a stable id, and it is the
 *     skip link's target, so focus genuinely lands there.
 *
 * The main element is not focusable itself, but we give it tabIndex={-1}
 * so the skip link can move focus into it programmatically. Without
 * that, Safari in particular will scroll but not move focus.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <div className="app-shell">
        <AppHeader />

        <div className="app-shell__body">
          <PrimaryNav />

          {/*
            tabIndex={-1} + id="main": the skip link's destination.
            See the note above about why focus, not just scroll.
          */}
          <main className="app-shell__main" id="main" tabIndex={-1}>
            {children ?? <Outlet />}
          </main>
        </div>

        {/*
          The nav is visually fixed to the bottom on mobile, so the
          content needs bottom padding equal to its height or the last
          step on Today would sit underneath it and be untappable.
        */}
        <div className="app-shell__nav-spacer" aria-hidden="true" />
      </div>
    </RouteErrorBoundary>
  )
}

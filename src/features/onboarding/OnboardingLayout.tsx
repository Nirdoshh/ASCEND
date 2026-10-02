import { Outlet, useLocation } from 'react-router-dom'

import { RouteErrorBoundary } from '../../app/RouteErrorBoundary'
import { useRouteFocus } from '../../app/useRouteFocus'
import type { OnboardingDraftRepository } from '../../data/repositories'
import { OnboardingDraftProvider } from './OnboardingDraftProvider'
import { StorageNotice } from './StorageNotice'
import './OnboardingLayout.css'

/**
 * The onboarding shell.
 *
 * Onboarding sits OUTSIDE the main AppShell, and that is a product
 * decision as much as a technical one. Someone who has not chosen a
 * Growth Area yet has no Journey, so the bottom navigation would offer
 * them four screens that are all empty. Showing it would imply they
 * already have something.
 *
 * What is borrowed from AppShell:
 *   - RouteErrorBoundary, so a crash on an onboarding screen is caught
 *     and retryable instead of blank. It lives inside the router here,
 *     which is where it is allowed to use router context.
 *   - The skip link and the <main> landmark with a stable id, so focus
 *     lands in the content rather than at the top of the document.
 *
 * What is NOT borrowed: the header and the primary navigation.
 *
 * The provider wraps the outlet rather than living in each screen, so
 * navigating between onboarding steps keeps one draft in memory. Two
 * providers would mean reloading from storage on every step change,
 * which is both slower and one more chance to lose an answer.
 *
 * The optional `repository` prop exists only so tests can supply an
 * in-memory or deliberately broken store. Production takes the default,
 * and no screen ever learns which one it got.
 */
export function OnboardingLayout({ repository }: { repository?: OnboardingDraftRepository }) {
  const mainRef = useRouteFocus()
  const { pathname } = useLocation()
  return (
    <RouteErrorBoundary>
      <a className="skip-link" href="#main">
        Skip to the question
      </a>

      <div className="onboarding">
        <OnboardingDraftProvider repository={repository}>
          <StorageNotice />

          <main ref={mainRef} className="onboarding__main" id="main" tabIndex={-1}>
            <div key={pathname} className="onboarding__content"><Outlet /></div>
          </main>
        </OnboardingDraftProvider>
      </div>
    </RouteErrorBoundary>
  )
}

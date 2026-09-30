import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { Button } from '../components/ui'
import './BootErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Application boot failure.
 *
 * This boundary exists for exactly one situation: ASCEND failed before
 * React Router context existed. `RouteErrorBoundary` cannot help there,
 * because it is rendered *inside* `RouterProvider` and never mounts if
 * boot fails above it. Without this boundary the user gets a blank white
 * page with no explanation and no way forward.
 *
 * Why this component has no dependencies:
 *
 *   The fallback runs when the app is already broken, so every import it
 *   pulls in is a way for the last line of defence to fail too. That is
 *   why it has:
 *
 *     - no data access, no storage reads, no preferences
 *     - no router hooks: no useLocation, useNavigate, useParams,
 *       useMatches, Link or NavLink. Nothing here may depend on the
 *       router, because the router is precisely what may not have booted.
 *     - no theme hooks, no analytics, no network requests
 *
 *   The one shared component it reuses is `Button`, which is a plain
 *   presentational element with no React context of its own. That is
 *   asserted by a test, so if `Button` ever grows a provider dependency
 *   the fallback fails loudly instead of silently at boot.
 *
 * It deliberately does NOT do these things:
 *
 *   - It never clears or rewrites stored data. If boot failed, the user's
 *     data may be perfectly intact and is the thing we most want to keep.
 *     Recovery is a reload, nothing more.
 *   - It never shows the error message, a stack trace or an error class
 *     name. Those are for us. The user gets plain language and one action.
 *
 * This is not a merge with RouteErrorBoundary. They cover different
 * failures and are deliberately separate components:
 *
 *   BootErrorBoundary   application initialisation
 *   RouteErrorBoundary  the routed application, once it is running
 */
class BootBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Deliberately console-only, matching RouteErrorBoundary. Phase 13
    // introduces a structured, privacy-safe reporter. We do NOT send
    // anything about the user's data off the device here.
    //
    // This is a documented exception to the no-console rule; it is one of
    // only two places in ASCEND that logs, so accidental logging
    // anywhere else is still reported.
    // eslint-disable-next-line no-console
    console.error('[ascend] boot error', error, info.componentStack)
  }

  private readonly handleReload = () => {
    // A full document reload is the honest recovery action: it discards
    // whatever broken JavaScript state caused the failure and gives the
    // app a clean chance to start. It is safe here precisely because this
    // boundary does not depend on the router, so nothing above us needs
    // to have mounted for the browser to be able to navigate.
    window.location.reload()
  }

  override render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="boot-error">
        {/*
          role="alert" so that if this appears *after* first paint (a
          failure while preferences or the router are still starting) it
          is announced rather than silently replacing the screen.
        */}
        <div className="boot-error__panel stack" role="alert">
          <h1 className="boot-error__title">ASCEND couldn&rsquo;t start.</h1>

          <p className="boot-error__body">Your data is still safe.</p>
          <p className="boot-error__body">Try reloading the app.</p>

          <Button variant="primary" size="lg" onClick={this.handleReload}>
            Reload ASCEND
          </Button>

          <p className="boot-error__hint text-sm text-muted">
            If this keeps happening, close and reopen the app.
          </p>
        </div>
      </main>
    )
  }
}

/**
 * Wrap the application in this. It must sit above `PreferencesProvider`
 * and `RouterProvider` so it can catch a failure to boot either of them.
 */
export function BootErrorBoundary({ children }: Props) {
  return <BootBoundary>{children}</BootBoundary>
}
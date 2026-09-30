import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { Button, ErrorState } from '../components/ui'

interface Props {
  children: ReactNode
  /** Changing this resets the boundary, so navigating away from a
   *  broken screen clears the error instead of stranding the user. */
  resetKey: string
}

interface State {
  error: Error | null
}

/**
 * Last-resort error boundary for the shell and every route.
 *
 * Copy follows the product rule: explain, preserve, offer recovery. A
 * user must never see an error class name, a stack trace or a database
 * constraint code — those are for us, not for them.
 *
 * The technical detail is still captured: we log it so it is available
 * during development and QA, without putting it on screen.
 */
class Boundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentionally console-only for now. Phase 13 introduces a
    // structured, privacy-safe error reporter. We do NOT send the
    // user's goal text or reflections anywhere.
    console.error('[ascend] render error', error, info.componentStack)
  }

  override componentDidUpdate(previous: Props) {
    // Navigating to a different screen clears the error. Without this,
    // one broken route would leave the user stuck on the error message
    // with no working navigation, because the error replaced the nav.
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private readonly handleRetry = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="route-error">
        <ErrorState
          title="Something went wrong on this screen"
          description={
            'Your plan and everything you have recorded are safe. This part of ASCEND did not load. You can try again.'
          }
          action={
            <Button variant="secondary" onClick={this.handleRetry}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}

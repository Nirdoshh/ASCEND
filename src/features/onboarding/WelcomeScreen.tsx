import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui'
import { useOnboarding } from './OnboardingDraftProvider'
import './WelcomeScreen.css'

/**
 * Step 1 — the welcome screen.
 *
 * One job: make a stranger understand what this is in about five
 * seconds, and get them to the first real question.
 *
 * What is deliberately absent:
 *
 *   - No sign-up, no account, no email field. Nothing is asked for
 *     before there is any reason to ask for it.
 *   - No feature list. Ten bullets is what an app shows when it does
 *     not trust its own promise. The promise fits in one sentence.
 *   - No jargon. Not "journey", not "habits", not "productivity". The
 *     word "Journey" arrives later, once it means something concrete,
 *     because a capitalised product word before the user has any
 *     context is just a word.
 *
 * The h1 is the promise rather than the wordmark, so a screen reader
 * and a search engine meet the same thing a sighted user reads first.
 */
export function WelcomeScreen() {
  const navigate = useNavigate()
  const { draft, begin } = useOnboarding()

  // Someone who already answered a question and came back here — via
  // the back button, or by reloading on this URL — is offered their
  // place rather than a fresh start. Discarding their work here would
  // be the worst possible thing this screen could do.
  const resuming = draft !== null

  const onStart = () => {
    begin()
    // React Router 7 types navigate() as possibly returning a promise,
    // because a data router may be loading a route in the background.
    // There is nothing to await here — the URL changes synchronously —
    // so the `void` states that rather than silencing a real check.
    void navigate('/onboarding/areas')
  }

  return (
    <div className="welcome">
      <p className="welcome__wordmark">ASCEND</p>

      <h1 className="welcome__title">Become the person you want to be.</h1>

      <p className="welcome__lead">One meaningful step at a time.</p>

      <p className="welcome__detail text-secondary">
        ASCEND helps you pick what to work on, then helps you actually do it. You can change anything
        later, and nothing here is permanent.
      </p>

      <div className="onboarding__actions">
        <Button variant="primary" size="lg" fullWidth onClick={onStart}>
          {resuming ? 'Continue where you left off' : 'Start my journey'}
        </Button>

        <p className="welcome__footnote text-sm text-muted">Takes about two minutes.</p>
      </div>
    </div>
  )
}
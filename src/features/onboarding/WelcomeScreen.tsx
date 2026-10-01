import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui'
import { hasStartedOnboarding, resumePath } from './resume'
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
 *
 * RESUMING IS A COMPUTED DECISION, NOT A LABEL
 *
 * "Continue where you left off" and "Start my journey" are the same two
 * buttons pointed at different places, and the wording follows the
 * destination rather than the other way round. Through Phase 2A this sent
 * everyone to step 2, which quietly threw away the Goal and the WHY for
 * anyone who had answered them. See resume.ts for how the destination is
 * worked out.
 *
 * JOURNEY ALREADY STARTED:
 *
 * If an active Journey exists (V1 allows only one), the welcome screen
 * must not invite the user to start another. Instead it shows a clear
 * path to Today.
 */
export function WelcomeScreen() {
  const navigate = useNavigate()
  const { draft, begin, hasActiveJourney } = useOnboarding()

  // If an active Journey exists, the user cannot start another onboarding.
  // Show a clear path to Today instead.
  const activeJourney = hasActiveJourney()

  if (activeJourney) {
    return (
      <div className="welcome">
        <p className="welcome__wordmark">ASCEND</p>

        <h1 className="welcome__title">Your Journey has already started.</h1>

        <p className="welcome__lead">You have an active Journey.</p>

        <div className="onboarding__actions">
          <Button variant="primary" size="lg" fullWidth onClick={() => void navigate('/today')}>
            Go to Today
          </Button>

          <p className="welcome__footnote text-sm text-muted">
            V1 supports one active Journey. Finish or delete it before starting a new one.
          </p>
        </div>
      </div>
    )
  }

  // A draft existing is not the same as a draft holding any answers.
  // Someone who pressed the first button and then closed the tab has a
  // draft and has answered nothing, and "Continue where you left off"
  // would be a lie for them.
  const resuming = hasStartedOnboarding(draft)

  const onStart = () => {
    begin()
    // React Router 7 types navigate() as possibly returning a promise,
    // because a data router may be loading a route in the background.
    // There is nothing to await here — the URL changes synchronously —
    // so the `void` states that rather than silencing a real check.
    void navigate(resuming ? resumePath(draft) : '/onboarding/areas')
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
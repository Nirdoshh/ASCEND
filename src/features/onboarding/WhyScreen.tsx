import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { MAX_WHY_LENGTH } from '../../domain/personalAnswer'
import { isWhyStepValid } from '../../domain/onboardingValidation'
import { AnswerStepScreen } from './AnswerStepScreen'
import { useOnboarding } from './OnboardingDraftProvider'

/** Keep the user's reason in their own words. */
export function WhyScreen() {
  const navigate = useNavigate()
  const { draft, setWhy, advanceFrom } = useOnboarding()

  const [text, setText] = useState(() => draft?.why?.text ?? '')

  return (
    <AnswerStepScreen
      question="Why does this matter to you?"
      body="Put your reason into words. This Journey starts with what matters to you."
      hint="Anything true is enough. A sentence in your own words is plenty."
      placeholder="Because I want to be the person my family sees"
      maxLength={MAX_WHY_LENGTH}
      value={text}
      onChange={(raw) => {
        setText(raw)
        setWhy(raw)
      }}
      validation={isWhyStepValid(draft)}
      onContinue={() => {
        advanceFrom('why')
        // React Router 7 types navigate() as possibly returning a promise.
        // There is nothing to await here, so `void` states that rather than
        // silencing a real check.
        void navigate('/onboarding/duration')
      }}
      backTo="/onboarding/goal"
    />
  )
}

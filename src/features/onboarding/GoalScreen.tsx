import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { MAX_GOAL_LENGTH } from '../../domain/personalAnswer'
import { isGoalStepValid } from '../../domain/onboardingValidation'
import { AnswerStepScreen } from './AnswerStepScreen'
import { useOnboarding } from './OnboardingDraftProvider'

/**
 * Step 3 — "What would you love to achieve?"
 *
 * The first thing the user writes, and the first place ASCEND could
 * quietly start grading them. So there is nothing here that grades.
 *
 * What is deliberately absent:
 *
 *   - No templates, no pick-from-a-list, no "top 10 goals". The examples
 *     in the hint are illustrations, and nothing anywhere checks the
 *     answer against them. Somebody whose goal is "be less anxious" is not
 *     being offered a menu of things they were not considering.
 *   - No smart capitalisation, no spell-check nudging, no "sounds great!"
 *     reaction. The sentence is stored exactly as typed, minus whitespace
 *     at the two ends. ASCEND does not rewrite what somebody wanted to
 *     say — see personalAnswer.ts.
 *   - No "make it smaller" coaching, even though the copy says they can.
 *     An offer, not a rule.
 *
 * The field is seeded from the draft on mount rather than held only in
 * local state, so a refresh, a back-button return or a deep link shows the
 * sentence the user already wrote instead of an empty box that looks like
 * the answer was lost.
 */
export function GoalScreen() {
  const navigate = useNavigate()
  const { draft, setGoal, advanceFrom } = useOnboarding()

  // Local on purpose: the draft holds the trimmed sentence, and an input
  // bound to it would swallow a trailing space and shove the caret back
  // mid-word. See AnswerStepScreenProps.value.
  const [text, setText] = useState(() => draft?.goal?.text ?? '')

  return (
    <AnswerStepScreen
      question="What would you love to achieve?"
      body="Describe it in your own words. It can be as big as you like — you can make it smaller later."
      hint="One sentence is plenty, and it can be about more than one thing."
      placeholder="Run my first 10K"
      maxLength={MAX_GOAL_LENGTH}
      value={text}
      onChange={(raw) => {
        setText(raw)
        setGoal(raw)
      }}
      // Asked of the domain, not decided here.
      validation={isGoalStepValid(draft)}
      onContinue={() => {
        advanceFrom('goal')
        // React Router 7 types navigate() as possibly returning a promise.
        // Nothing is awaited here — the URL changes synchronously — so
        // `void` states that rather than silencing a real check.
        void navigate('/onboarding/why')
      }}
      backTo="/onboarding/areas"
    />
  )
}

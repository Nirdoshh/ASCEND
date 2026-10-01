import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { MAX_WHY_LENGTH } from '../../domain/personalAnswer'
import { isWhyStepValid } from '../../domain/onboardingValidation'
import { AnswerStepScreen } from './AnswerStepScreen'
import { useOnboarding } from './OnboardingDraftProvider'

/**
 * Step 4 — "Why does this matter to you?"
 *
 * The WHY is first-class ASCEND data, not motivational decoration, and
 * that changes how this screen is built.
 *
 * Future features read it back to the user: Recovery after a missed day,
 * the daily reflection, the weekly review, a milestone, a bad Tuesday.
 * That means the sentence has to still be true and still be theirs months
 * later, so:
 *
 *   - Nothing is suggested, and nothing is ever inserted on their behalf.
 *     A WHY that ASCEND made up is worth nothing on the day somebody needs
 *     to hear it, and the app would have no way to know that.
 *   - Nothing is rewritten. Not the tense, not the spelling, not the
 *     punctuation. Whatever they typed is what gets stored.
 *   - No scoring, no "that's a great reason", no encouragement that could
 *     read as a verdict. They wrote a true thing about themselves; that is
 *     the whole achievement.
 *
 * WHY IT NOW HAS SOMEWHERE TO GO, AND WHY THE BOUNDARY NOTE IS GONE
 *
 * Through Phase 2B this was the last built step, so Continue said so and
 * stopped. Phase 2C built the duration question, so the boundary moved
 * forward and this is now an ordinary step. The `finishedMessage` prop is
 * gone from the call rather than left in place: a configuration option that
 * is never passed is one that rots, and the note it produced — "the next
 * question is not built yet" — would now be actively false.
 *
 * `AnswerStepScreen` still supports `finishedMessage`, because the Daily
 * Effort screen at the other end of Phase 2C needs exactly that treatment.
 * The prop is not dead; it just belongs to the last step, and the last step
 * moved.
 */
export function WhyScreen() {
  const navigate = useNavigate()
  const { draft, setWhy, advanceFrom } = useOnboarding()

  const [text, setText] = useState(() => draft?.why?.text ?? '')

  return (
    <AnswerStepScreen
      question="Why does this matter to you?"
      body="When things get difficult, we’ll remind you why you started."
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

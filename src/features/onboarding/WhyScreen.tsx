import { useState } from 'react'

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
 * WHY NO NAVIGATION FORWARD
 *
 * This is the last step Phase 2B builds, so Continue does not go anywhere.
 * It says so, in the same voice Phase 2A used at the end of the Growth
 * Areas step: the answers are saved, the next question is real and planned,
 * and it is not here yet. A button that silently did nothing would be the
 * single most dishonest thing this screen could do.
 */
export function WhyScreen() {
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
      }}
      backTo="/onboarding/goal"
      finishedMessage="Your answers are saved. The next question is how long you want to work on this, and that part is not built yet."
    />
  )
}

import {
  DAILY_EFFORT_BOUNDS,
  DAILY_EFFORT_PRESET_MINUTES,
  DAILY_EFFORT_UNIT_MINUTES,
} from '../../domain/schedule'
import { isEffortStepValid } from '../../domain/onboardingValidation'
import { NumberChoiceStepScreen } from './NumberChoiceStepScreen'
import { useOnboarding } from './OnboardingDraftProvider'

/**
 * Step 7, and the last screen Phase 2C builds — "How much time can you
 * realistically give this each day?"
 *
 * THE WORD "REALISTICALLY" IS THE WHOLE QUESTION
 *
 * The brief asks for an answer that discourages fantasy without shaming
 * anybody, and those two pull in opposite directions. The resolution is that
 * the word does all the work and the app does none:
 *
 *   - The question says "realistically", and the body sentence explains what
 *     that means on a normal day. Both are in the user's own voice, not the
 *     app's.
 *   - The validator has NO opinion about the number. It checks that one was
 *     given and that it is inside 5–480 minutes, and nothing else. There is no
 *     "that seems like a lot" and no "are you sure".
 *   - There is no comparison against the Duration. 90 days at 10 minutes and
 *     30 days at 90 minutes are both completely valid, because judging one
 *     against the other is the exact judgement this phase refuses to make.
 *
 * The floor is 5 minutes deliberately. It is the honest answer for a lot of
 * people, and a floor that excluded it would exclude the person being most
 * truthful — the opposite of what the question is for.
 *
 * WHY THIS ONE ENDS WITH A BOUNDARY NOTE
 *
 * Phase 2D owns the Summary screen and the act of creating a Journey from
 * these answers. There is no screen after this one, so Continue records the
 * answer and says so plainly, the way Phase 2A and 2B did at their own
 * boundaries. A Continue button that quietly did nothing, or a success screen
 * for a Journey that was never created, would be the single most dishonest
 * thing this screen could do.
 */
export function EffortScreen() {
  const { draft, setEffort, advanceFrom } = useOnboarding()

  return (
    <NumberChoiceStepScreen
      question="How much time can you realistically give this each day?"
      body="Think about a normal day, not a perfect one."
      presets={DAILY_EFFORT_PRESET_MINUTES}
      unit={DAILY_EFFORT_UNIT_MINUTES}
      bounds={DAILY_EFFORT_BOUNDS}
      customLabel="Something else"
      customFieldLabel="How many minutes?"
      customHint="Any whole number from 5 to 480."
      customPlaceholder="e.g. 25"
      value={draft?.dailyEffortMinutes}
      onSelect={setEffort}
      validation={isEffortStepValid(draft)}
      onContinue={() => {
        advanceFrom('daily-effort')
      }}
      backTo="/onboarding/milestones"
      finishedMessage="Your answers are saved. The next part is looking at everything together, and that is not built yet."
    />
  )
}

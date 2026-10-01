import { useNavigate } from 'react-router-dom'

import {
  DURATION_BOUNDS,
  DURATION_PRESET_DAYS,
  DURATION_UNIT_DAYS,
} from '../../domain/schedule'
import { isDurationStepValid } from '../../domain/onboardingValidation'
import { NumberChoiceStepScreen } from './NumberChoiceStepScreen'
import { useOnboarding } from './OnboardingDraftProvider'

/**
 * Step 5 — "How long do you want to work toward this?"
 *
 * A COUNT OF DAYS, never a pair of calendar dates, and the reasoning is in
 * schedule.ts: a start date depends on when Continue was pressed, so a draft
 * written on Sunday and one written on Monday would be genuinely different
 * answers that are really the same answer. The date belongs in Phase 2D, where
 * the Journey is created and a start actually exists.
 *
 * WHY "WORK TOWARD" RATHER THAN "WORK ON"
 *
 * The Goal is an outcome and this is the span it has to happen in. "Work
 * toward this" says the two are connected without implying the user is
 * promising a result — which they are not, and which ASCEND never asks for.
 *
 * WHY THE COPY DOES NOT MENTION WHAT HAPPENS AT THE END
 *
 * There is no streak, no finish line and nothing to lose. Saying "you can
 * change it later" is true and is the only reassurance the question needs; a
 * countdown would turn a plan into a deadline, and this is the same app that
 * tells people a missed day is not a failure.
 *
 * NO NAVIGATION DECISION LIVES HERE. `onContinue` records the answer and hands
 * the user to the milestones question, exactly as every other step does. The
 * screen never learns a URL.
 */
export function DurationScreen() {
  const navigate = useNavigate()
  const { draft, setDuration, advanceFrom } = useOnboarding()

  return (
    <NumberChoiceStepScreen
      question="How long do you want to work toward this?"
      body="Pick a span you can picture. It does not have to be exact."
      presets={DURATION_PRESET_DAYS}
      unit={DURATION_UNIT_DAYS}
      bounds={DURATION_BOUNDS}
      customLabel="Something else"
      customFieldLabel="How many days?"
      customHint="Any whole number from 7 to 365."
      customPlaceholder="e.g. 120"
      value={draft?.durationDays}
      onSelect={setDuration}
      validation={isDurationStepValid(draft)}
      onContinue={() => {
        advanceFrom('duration')
        void navigate('/onboarding/milestones')
      }}
      backTo="/onboarding/why"
    />
  )
}

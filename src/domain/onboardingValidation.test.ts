import { describe, expect, it } from 'vitest'

import { suggestedGrowthAreaId } from './growthAreaId'
import { SUGGESTED_GROWTH_AREAS } from './growthAreas'
import {
  addCustomGrowthArea,
  addMilestone,
  completeStep,
  createOnboardingDraft,
  ONBOARDING_STEPS,
  selectGrowthArea,
  setDailyEffortMinutes,
  setDurationDays,
  setGoal,
  setWhy,
  type OnboardingDraft,
} from './onboardingDraft'
import {
  answeredSteps,
  isDurationStepValid,
  isEffortStepValid,
  isGoalStepValid,
  isGrowthAreaStepValid,
  isMilestoneStepValid,
  isWhyStepValid,
  validateOnboardingDraft,
  type OnboardingProblem,
  type StepValidation,
} from './onboardingValidation'
import { DAILY_EFFORT_BOUNDS, DAILY_EFFORT_PRESET_MINUTES, DURATION_BOUNDS, DURATION_PRESET_DAYS } from './schedule'
import { MAX_MILESTONES } from './milestone'
import { MAX_GOAL_LENGTH, MAX_WHY_LENGTH } from './personalAnswer'

const T0 = '2026-10-01T09:00:00.000Z'

/** A suggested area, looked up by the id it ships with. See the note in
 * onboardingDraft.test.ts: a throwing lookup names the missing id, where
 * `find(...)!` only says "cannot read properties of undefined". */
function suggested(id: string) {
  const area = SUGGESTED_GROWTH_AREAS.find((candidate) => candidate.id === id)

  if (!area) throw new Error(`no such suggested Growth Area: ${id}`)
  return area
}

const FITNESS = suggested(suggestedGrowthAreaId('fitness'))
const READING = suggested(suggestedGrowthAreaId('reading'))

function withFitness(): OnboardingDraft {
  return selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T0)
}

function withGoal(draft: OnboardingDraft, text: string): OnboardingDraft {
  return setGoal(draft, text, T0)
}

function withWhy(draft: OnboardingDraft, text: string): OnboardingDraft {
  return setWhy(draft, text, T0)
}

function withDuration(draft: OnboardingDraft, days: number): OnboardingDraft {
  return setDurationDays(draft, days, T0)
}

function withMilestones(draft: OnboardingDraft, texts: readonly string[]): OnboardingDraft {
  return texts.reduce(
    (current, text, index) => {
      const result = addMilestone(current, `ms_test_${index}`, text, T0)
      if (!result.ok) throw new Error(`test milestone refused: ${result.message}`)
      return result.draft
    },
    draft,
  )
}

function withEffort(draft: OnboardingDraft, minutes: number): OnboardingDraft {
  return setDailyEffortMinutes(draft, minutes, T0)
}

/**
 * A draft where every question Phase 2C asks has been answered.
 *
 * Built through the real setters rather than by assigning fields, so it
 * cannot describe a state the domain has no way to produce.
 */
function fullyAnswered(): OnboardingDraft {
  return withEffort(
    withMilestones(
      withDuration(withWhy(withGoal(withFitness(), 'Run my first 10K'), 'Because I can'), 30),
      ['Run 5 km without stopping'],
    ),
    20,
  )
}

/** Force a field, to build drafts that no honest UI could produce. */
function withField<K extends keyof OnboardingDraft>(
  draft: OnboardingDraft,
  key: K,
  value: OnboardingDraft[K],
): OnboardingDraft {
  return { ...draft, [key]: value }
}

function problemOf(
  result: ReturnType<typeof validateOnboardingDraft> | StepValidation,
): OnboardingProblem {
  if (result.valid) throw new Error('expected an invalid draft')
  return result.problem
}

/** Narrows to the failure branch, so a test can read what went wrong. */
function failure(
  result: ReturnType<typeof validateOnboardingDraft>,
): { firstIncompleteStep: string; problem: OnboardingProblem; message: string } {
  if (result.valid) throw new Error('expected an invalid draft')
  return result
}

describe('isGrowthAreaStepValid', () => {
  it('is not valid when there is no draft at all', () => {
    const result = isGrowthAreaStepValid(null)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.problem).toBe('unanswered')
    expect(result.message).toBe('Choose at least one Growth Area.')
  })

  it('is not valid when nothing is chosen', () => {
    const result = isGrowthAreaStepValid(createOnboardingDraft(T0))

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.problem).toBe('unanswered')
  })

  it('is valid with one chosen area', () => {
    expect(isGrowthAreaStepValid(withFitness())).toEqual({ valid: true })
  })

  it('is valid with several chosen areas', () => {
    const draft = selectGrowthArea(withFitness(), READING.id, T0)
    expect(isGrowthAreaStepValid(draft).valid).toBe(true)
  })

  it('is not valid when a chosen area cannot be displayed', () => {
    // Not paranoia: a draft written by an older build, or edited by hand,
    // or whose suggestion was retired later can all carry an id with no
    // area behind it. Counting it would let someone pass a step whose
    // choice the screen is not showing.
    const draft = withField(withFitness(), 'selectedGrowthAreaIds', [
      FITNESS.id,
      'ga_retiredina-later-build',
    ])

    const result = isGrowthAreaStepValid(draft)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.problem).toBe('unresolvable')
    expect(result.message).toBe('One of the chosen areas is no longer available. Choose again.')
  })

  it('ignores the step the user happens to be on', () => {
    const draft = withField(withFitness(), 'currentStep', 'welcome')
    expect(isGrowthAreaStepValid(draft).valid).toBe(true)
  })
})

describe('isGoalStepValid and isWhyStepValid', () => {
  // The two free-text steps share one rule set, so most cases are run
  // against both. Writing them once keeps a divergence between the two
  // from being possible, which is the point of sharing the implementation.
  const steps = [
    {
      label: 'goal',
      validate: isGoalStepValid,
      write: setGoal,
      limit: MAX_GOAL_LENGTH,
      unanswered: 'Tell us what you would love to achieve.',
      tooLong: `That is a bit long. Keep your goal to ${MAX_GOAL_LENGTH} characters or fewer.`,
    },
    {
      label: 'why',
      validate: isWhyStepValid,
      write: setWhy,
      limit: MAX_WHY_LENGTH,
      unanswered: 'Tell us why this matters to you.',
      tooLong: `That is a bit long. Keep it to ${MAX_WHY_LENGTH} characters or fewer.`,
    },
  ] as const

  for (const step of steps) {
    describe(`the ${step.label} step`, () => {
      const draftWith = (text: string) => step.write(createOnboardingDraft(T0), text, T0)

      it('is not valid when there is no draft at all', () => {
        expect(step.validate(null)).toEqual({
          valid: false,
          problem: 'unanswered',
          message: step.unanswered,
        })
      })

      it('is not valid when the question has not been asked', () => {
        expect(step.validate(createOnboardingDraft(T0))).toEqual({
          valid: false,
          problem: 'unanswered',
          message: step.unanswered,
        })
      })

      it('is valid with one real sentence', () => {
        expect(step.validate(draftWith('Run my first 10K'))).toEqual({ valid: true })
      })

      it('is not valid when the box is emptied again', () => {
        // The setter removes the field, so this is the same state as
        // never having answered. Asserted separately because "delete the
        // key" is the behaviour that keeps it true.
        const draft = step.write(draftWith('Run my first 10K'), '   ', T0)

        expect(step.validate(draft)).toEqual({
          valid: false,
          problem: 'unanswered',
          message: step.unanswered,
        })
      })

      it('is not valid for stored whitespace, which storage could produce', () => {
        // Unreachable through the app, reachable by hand-editing storage.
        // A field of spaces is not what anybody meant, and refusing it is
        // better than passing the step on it.
        const draft: OnboardingDraft = {
          ...createOnboardingDraft(T0),
          [step.label]: { text: '   \n  ' },
        }

        expect(step.validate(draft)).toEqual({
          valid: false,
          problem: 'unanswered',
          message: step.unanswered,
        })
      })

      it('validates the trimmed length, not the raw one', () => {
        // The limit is about how much the user wrote, not how much they
        // padded it with. Rejecting a padded-but-legal sentence would make
        // the message lie about the cause of the problem.
        const atLimit = 'x'.repeat(step.limit)
        const draft: OnboardingDraft = {
          ...createOnboardingDraft(T0),
          [step.label]: { text: `    ${atLimit}    ` },
        }

        expect(step.validate(draft)).toEqual({ valid: true })
      })

      it('is valid at exactly the limit', () => {
        expect(step.validate(draftWith('x'.repeat(step.limit)))).toEqual({ valid: true })
      })

      it('is not valid one character past the limit', () => {
        // `too-long`, never `unanswered`. The user HAS answered, and saying
        // otherwise would leave them retyping a sentence they already wrote
        // correctly.
        expect(step.validate(draftWith('x'.repeat(step.limit + 1)))).toEqual({
          valid: false,
          problem: 'too-long',
          message: step.tooLong,
        })
      })

      it('does not shorten an over-long answer to make it valid', () => {
        // The fix belongs to the user. Storing a truncated sentence would
        // lose the end of what they wrote and then pass the step on it.
        const long = 'x'.repeat(step.limit + 40)
        const draft = draftWith(long)

        expect(draft[step.label]).toEqual({ text: long })
        expect(step.validate(draft).valid).toBe(false)
      })

      it('accepts punctuation, emoji and any language unchanged', () => {
        const answers = [
          'Why not? Really — why not!! (seriously)',
          'Learn three songs 🎹 and ride a bike 🚴',
          '跑我的第一個馬拉松',
          'Освоить три песни, сыграть их наизусть',
        ]

        for (const answer of answers) {
          expect(step.validate(draftWith(answer)), answer).toEqual({ valid: true })
          expect(draftWith(answer)[step.label]).toEqual({ text: answer })
        }
      })

      it('accepts a one-word answer, because brevity is not a failure', () => {
        // ASCEND does not grade the content of a goal or a reason. Someone
        // who writes "Piano" has answered the question, and being told
        // their answer was insufficient at the moment they are trying to
        // start would be the opposite of encouragement.
        expect(step.validate(draftWith('Piano'))).toEqual({ valid: true })
      })

      it('ignores the step the user happens to be on', () => {
        const draft = withField(draftWith('Run my first 10K'), 'currentStep', 'welcome')
        expect(step.validate(draft)).toEqual({ valid: true })
      })
    })
  }

  it('never judges the Goal against the Growth Areas', () => {
    // One answer covers the whole Journey, so there is nothing to resolve
    // and nothing to be inconsistent with. A goal written before any area
    // is chosen is still a valid answer to this question.
    const draft = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T0)

    expect(isGoalStepValid(draft).valid).toBe(true)
    expect(isGoalStepValid(setGoal(withFitness(), 'Run my first 10K', T0)).valid).toBe(true)
  })

  it('keeps one answer’s over-length failure out of the other’s', () => {
    // Separate limits, separate messages. A 350-character WHY is fine; a
    // 350-character Goal is not, and the Goal's complaint must not appear
    // on the WHY screen.
    const draft = setGoal(setWhy(withFitness(), 'y'.repeat(400), T0), 'x'.repeat(400), T0)

    expect(isWhyStepValid(draft)).toEqual({ valid: true })
    expect(problemOf(isGoalStepValid(draft))).toBe('too-long')
  })
})

describe('isDurationStepValid and isEffortStepValid', () => {
  // The two numeric steps share one rule set, exactly as the two free-text
  // steps do, so the cases are written once and run against both. The only
  // differences are the bounds, the wording and the field the answer lands in.
  const steps = [
    {
      label: 'duration',
      validate: isDurationStepValid,
      write: withDuration,
      bounds: DURATION_BOUNDS,
      presets: DURATION_PRESET_DAYS,
    },
    {
      label: 'effort',
      validate: isEffortStepValid,
      write: withEffort,
      bounds: DAILY_EFFORT_BOUNDS,
      presets: DAILY_EFFORT_PRESET_MINUTES,
    },
  ] as const

  for (const step of steps) {
    describe(`the ${step.label} step`, () => {
      it('is not valid when there is no draft at all', () => {
        expect(step.validate(null)).toEqual({
          valid: false,
          problem: 'unanswered',
          message: `Choose how many ${step.bounds.unit} you want.`,
        })
      })

      it('is not valid before the question is answered', () => {
        expect(step.validate(createOnboardingDraft(T0))).toEqual({
          valid: false,
          problem: 'unanswered',
          message: `Choose how many ${step.bounds.unit} you want.`,
        })
      })

      it('is valid for any preset', () => {
        for (const value of step.presets) {
          expect(step.validate(step.write(createOnboardingDraft(T0), value)), String(value)).toEqual(
            { valid: true },
          )
        }
      })

      it('is valid at exactly the minimum and exactly the maximum', () => {
        expect(step.validate(step.write(createOnboardingDraft(T0), step.bounds.min))).toEqual({
          valid: true,
        })
        expect(step.validate(step.write(createOnboardingDraft(T0), step.bounds.max))).toEqual({
          valid: true,
        })
      })

      it('is invalid — OUT OF RANGE, not unanswered — for a stored value below the minimum', () => {
        // The distinction is the whole design. Our screens cannot store this,
        // so it is hand-edited storage, and a number is there. Saying "choose
        // how many" would tell the user they had not answered when the
        // screen would be showing them a number.
        const draft = withField(
          createOnboardingDraft(T0),
          step.label === 'duration' ? 'durationDays' : 'dailyEffortMinutes',
          step.bounds.min - 1,
        )

        expect(step.validate(draft)).toEqual({
          valid: false,
          problem: 'out-of-range',
          message: `Choose between ${step.bounds.min} and ${step.bounds.max} ${step.bounds.unit}.`,
        })
      })

      it('is invalid — OUT OF RANGE — for a stored value above the maximum', () => {
        const draft = withField(
          createOnboardingDraft(T0),
          step.label === 'duration' ? 'durationDays' : 'dailyEffortMinutes',
          step.bounds.max + 1,
        )

        expect(step.validate(draft)).toEqual({
          valid: false,
          problem: 'out-of-range',
          message: `Choose between ${step.bounds.min} and ${step.bounds.max} ${step.bounds.unit}.`,
        })
      })

      it('does not treat an out-of-range value as answered-and-fine', () => {
        // A regression guard with teeth: if the bounds check were dropped,
        // every other test here would still pass.
        const draft = withField(
          createOnboardingDraft(T0),
          step.label === 'duration' ? 'durationDays' : 'dailyEffortMinutes',
          step.bounds.max * 100,
        )

        expect(step.validate(draft).valid).toBe(false)
      })

      it('ignores the step the user happens to be on', () => {
        const draft = withField(
          step.write(createOnboardingDraft(T0), step.bounds.min),
          'currentStep',
          'welcome',
        )

        expect(step.validate(draft)).toEqual({ valid: true })
      })
    })
  }

  it('never compares the Duration against the Daily Effort', () => {
    // 90 days at 5 minutes and 7 days at 480 minutes are both legal. Judging
    // one against the other is the exact judgement this phase refuses.
    const shortDaysLongSessions = withEffort(withDuration(withFitness(), 7), 480)
    const longDaysShortSessions = withEffort(withDuration(withFitness(), 365), 5)

    expect(isDurationStepValid(shortDaysLongSessions).valid).toBe(true)
    expect(isEffortStepValid(shortDaysLongSessions).valid).toBe(true)
    expect(isDurationStepValid(longDaysShortSessions).valid).toBe(true)
    expect(isEffortStepValid(longDaysShortSessions).valid).toBe(true)
  })
})

describe('isMilestoneStepValid', () => {
  it('is not valid when there is no draft at all', () => {
    expect(isMilestoneStepValid(null)).toEqual({
      valid: false,
      problem: 'unanswered',
      message: 'Add at least one thing that would prove it is working.',
    })
  })

  it('is not valid before the question is answered', () => {
    expect(isMilestoneStepValid(createOnboardingDraft(T0))).toEqual({
      valid: false,
      problem: 'unanswered',
      message: 'Add at least one thing that would prove it is working.',
    })
  })

  it('is not valid for a stored empty list, which our own screens cannot write', () => {
    // `removeMilestone` deletes the key when the last one goes. An empty list
    // can only arrive by hand-editing, and it is not an answer.
    const draft = withField(createOnboardingDraft(T0), 'milestones', [])

    expect(problemOf(isMilestoneStepValid(draft))).toBe('unanswered')
  })

  it('is valid with exactly one milestone', () => {
    expect(isMilestoneStepValid(withMilestones(createOnboardingDraft(T0), ['Run 5 km']))).toEqual({
      valid: true,
    })
  })

  it('is valid at exactly the maximum', () => {
    const texts = Array.from({ length: MAX_MILESTONES }, (_, index) => `Milestone ${index}`)

    expect(isMilestoneStepValid(withMilestones(createOnboardingDraft(T0), texts))).toEqual({
      valid: true,
    })
  })

  it('is invalid with one more than the maximum, and says what to do about it', () => {
    // Only reachable from hand-edited storage, and refusing is the honest
    // move: four of these six are sentences somebody typed, and truncating
    // them would delete real work. Built by hand because `addMilestone`
    // correctly refuses to produce this state.
    const draft = withField(
      createOnboardingDraft(T0),
      'milestones',
      Array.from({ length: MAX_MILESTONES + 1 }, (_, index) => ({
        id: `ms_${index}`,
        text: `Milestone ${index}`,
      })),
    )

    expect(isMilestoneStepValid(draft)).toEqual({
      valid: false,
      problem: 'too-long',
      message: `Keep it to ${MAX_MILESTONES} or fewer — try to combine two.`,
    })
  })

  it('does not care what a milestone says', () => {
    // One word, an emoji and a sentence are all answers. ASCEND does not
    // grade content, and this is where that would show up if it ever did.
    for (const text of ['Piano', '🎹', 'Run 5 km without stopping 🏃']) {
      expect(isMilestoneStepValid(withMilestones(createOnboardingDraft(T0), [text])), text).toEqual(
        { valid: true },
      )
    }
  })

  it('ignores the step the user happens to be on', () => {
    const draft = withField(
      withMilestones(createOnboardingDraft(T0), ['Run 5 km']),
      'currentStep',
      'welcome',
    )

    expect(isMilestoneStepValid(draft)).toEqual({ valid: true })
  })
})

describe('validateOnboardingDraft — currentStep means nothing', () => {
  it('refuses a draft that has never started', () => {
    const result = validateOnboardingDraft(null)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('welcome')
    expect(result.problem).toBe('not-started')
  })

  it('stops at the first step that is not satisfied', () => {
    const result = validateOnboardingDraft(createOnboardingDraft(T0))

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('growth-areas')
    expect(result.problem).toBe('unanswered')
  })

  it('refuses a draft sitting on a later step with an unusable selection', () => {
    // THE RULE. A user who reached step 4 has not, by that fact, answered
    // step 2. Every real way this happens is a bug waiting to be a
    // corrupted Journey: a suggestion retired in a release, storage edited
    // by hand, a direct URL entry, or a future build writing a step this
    // build has never heard of.
    const draft = withField(withField(createOnboardingDraft(T0), 'currentStep', 'goal'), 'selectedGrowthAreaIds', [
      'ga_retiredina-later-build',
    ])

    const result = validateOnboardingDraft(draft)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('growth-areas')
    expect(result.problem).toBe('unresolvable')
  })

  it('refuses a draft that jumped to the final step having answered nothing', () => {
    const draft = withField(createOnboardingDraft(T0), 'currentStep', 'summary')

    expect(failure(validateOnboardingDraft(draft)).problem).toBe('unanswered')
    expect(failure(validateOnboardingDraft(draft)).firstIncompleteStep).toBe('growth-areas')
  })

  it('validates a draft whose currentStep is behind the actual answers', () => {
    // The converse of the rule above: a user who selected an area and then
    // went back to step 1 has still answered step 2. Validity is read from
    // the data, never from the pointer. It also proves Phase 2B did not
    // weaken the gate: the draft is still refused, now at the Goal rather
    // than at a step that has no rule at all.
    const draft = withField(withFitness(), 'currentStep', 'welcome')

    expect(failure(validateOnboardingDraft(draft)).problem).toBe('unanswered')
    expect(failure(validateOnboardingDraft(draft)).firstIncompleteStep).toBe('goal')
  })

  it('reaches the summary step and validates it — Phase 2D opens the gate', () => {
    // Phase 2D adds the summary validator. A fully answered draft now passes
    // all validators including summary, so the gate opens.
    const result = validateOnboardingDraft(fullyAnswered())

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.completedSteps).toContain('summary')
  })

  it('stops one step short once every Phase 2C question is answered', () => {
    // The progression through the phases, stated as data. Each of these is
    // the same draft with one more group of answers, and the stopping point
    // moves forward by exactly one screen each time. Nothing here relaxes
    // the gate; the only thing that changes is how far a user can get.
    const goalOnly = withGoal(withFitness(), 'Run my first 10K')
    const withWhyAnswered = withWhy(goalOnly, 'Because I can')
    const withDurationAnswered = withDuration(withWhyAnswered, 30)
    const withMilestonesAnswered = withMilestones(withDurationAnswered, ['Run 5 km'])

    expect(failure(validateOnboardingDraft(goalOnly)).firstIncompleteStep).toBe('why')
    expect(failure(validateOnboardingDraft(withWhyAnswered)).firstIncompleteStep).toBe('duration')
    expect(failure(validateOnboardingDraft(withDurationAnswered)).firstIncompleteStep).toBe(
      'milestones',
    )
    expect(failure(validateOnboardingDraft(withMilestonesAnswered)).firstIncompleteStep).toBe(
      'daily-effort',
    )
    // Phase 2D: a fully answered draft now reaches the summary step and is valid.
    // The summary validator checks that all previous steps are satisfied.
    expect(validateOnboardingDraft(fullyAnswered()).valid).toBe(true)
  })

  it('returns valid for a fully answered draft — Phase 2D opens the gate', () => {
    // Phase 2D adds the summary validator. A draft that has answered every
    // required question is now valid, and the gate opens. The summary step
    // does not ask a question; it is the review screen. Its validity is
    // defined as "every required answer has been given and is usable".
    const complete = fullyAnswered()

    const result = validateOnboardingDraft(complete)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.completedSteps).toContain('summary')
  })

  it('does not depend on a custom area any more than a suggested one', () => {
    const draft = addCustomGrowthArea(createOnboardingDraft(T0), { id: 'ga_x', name: 'Piano', normalizedName: 'piano' }, T0)

    expect(problemOf(validateOnboardingDraft(draft))).toBe('unanswered')
  })

  it('does not depend on how the draft was advanced', () => {
    // Whether the user pressed Continue or hand-wrote the object, the
    // answer is identical. A function that only accepts drafts produced
    // by the UI is not a validation function.
    const viaButton = completeStep(withFitness(), 'growth-areas', T0)
    const byHand = withField(withFitness(), 'currentStep', 'goal')

    expect(validateOnboardingDraft(viaButton)).toEqual(validateOnboardingDraft(byHand))
  })
})

describe('validateOnboardingDraft — every step is reachable through the same gate', () => {
  it('reports a completed list once every step has a rule', () => {
    // Temporarily registers the rules the remaining steps will need, to
    // prove the aggregator is genuinely generic: adding a screen means
    // adding one function, and the whole journey unlocks with no change
    // to validateOnboardingDraft.
    const draft = withField(withFitness(), 'currentStep', 'summary')

    const result = validateOnboardingDraft(draft, {
      'growth-areas': isGrowthAreaStepValid,
      goal: () => ({ valid: true }) as const,
      why: () => ({ valid: true }) as const,
      duration: () => ({ valid: true }) as const,
      milestones: () => ({ valid: true }) as const,
      'daily-effort': () => ({ valid: true }) as const,
      summary: () => ({ valid: true }) as const,
    })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.completedSteps).toEqual([...ONBOARDING_STEPS])
  })

  it('stops at whichever rule reports a failure, not at the last step', () => {
    const result = validateOnboardingDraft(withFitness(), {
      'growth-areas': isGrowthAreaStepValid,
      goal: () => ({ valid: true }) as const,
      why: () => ({ valid: false, problem: 'unanswered', message: 'Tell us why.' }) as const,
    })

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('why')
    expect(result.message).toBe('Tell us why.')
  })

  it('passes the same draft to every rule', () => {
    const seen: OnboardingDraft[] = []

    validateOnboardingDraft(withFitness(), {
      'growth-areas': (draft) => {
        seen.push(draft)
        return { valid: true } as const
      },
      goal: (draft) => {
        seen.push(draft)
        return { valid: false, problem: 'unanswered', message: 'x' } as const
      },
    })

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })
})

describe('answeredSteps', () => {
  it('counts nothing when there is no draft', () => {
    expect(answeredSteps(null)).toEqual([])
  })

  it('stops at the first gap rather than counting scattered successes', () => {
    // A draft that somehow satisfies step 2 but not step 3 must not be
    // reported as "3 of 6 answered", because a progress indicator built
    // on that would tell a lie the user could not see.
    const draft = withField(withFitness(), 'currentStep', 'summary')

    expect(answeredSteps(draft)).toEqual(['welcome', 'growth-areas'])
  })

  it('agrees with validateOnboardingDraft about the first gap', () => {
    const draft = withFitness()

    expect(answeredSteps(draft)).toEqual(['welcome', 'growth-areas'])
    expect(failure(validateOnboardingDraft(draft)).firstIncompleteStep).toBe('goal')
  })

  it('reports only welcome for an untouched draft', () => {
    expect(answeredSteps(createOnboardingDraft(T0))).toEqual(['welcome'])
  })
})

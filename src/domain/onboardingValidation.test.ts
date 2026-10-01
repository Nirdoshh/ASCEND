import { describe, expect, it } from 'vitest'

import { suggestedGrowthAreaId } from './growthAreaId'
import { SUGGESTED_GROWTH_AREAS } from './growthAreas'
import {
  addCustomGrowthArea,
  completeStep,
  createOnboardingDraft,
  ONBOARDING_STEPS,
  selectGrowthArea,
  setGoal,
  setWhy,
  type OnboardingDraft,
} from './onboardingDraft'
import {
  answeredSteps,
  isGoalStepValid,
  isGrowthAreaStepValid,
  isWhyStepValid,
  validateOnboardingDraft,
  type OnboardingProblem,
  type StepValidation,
} from './onboardingValidation'
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

  it('reaches the first unbuilt step and says so honestly', () => {
    // Phase 2B has rules for growth-areas, goal and why, so `duration`
    // cannot be satisfied. Reporting `not-answered-yet` rather than
    // `unanswered` keeps our gap clearly distinguishable from a user who
    // skipped a question — and it is the reason a half-built phase cannot
    // masquerade as a complete one.
    const result = validateOnboardingDraft(withWhy(withGoal(withFitness(), 'Run my first 10K'), 'Because I can'))

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('duration')
    expect(result.problem).toBe('not-answered-yet')
    expect(result.message).toBe(
      'The “duration” step has not been built yet, so onboarding cannot be completed.',
    )
  })

  it('cannot be made valid by this build, and does not pretend otherwise', () => {
    // The single most important assertion about Phase 2B. A phase that
    // quietly relaxed validateOnboardingDraft to make itself look finished
    // would let a Journey be created from a draft with no duration, no
    // milestones and no daily effort. Two real answers, a satisfied
    // earlier step and a currentStep that claims the end is not enough.
    const complete = withField(
      withWhy(withGoal(withFitness(), 'Run my first 10K'), 'Because I can'),
      'currentStep',
      'summary',
    )

    const result = validateOnboardingDraft(complete)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('duration')
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

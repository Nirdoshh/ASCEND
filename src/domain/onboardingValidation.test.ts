import { describe, expect, it } from 'vitest'

import { SUGGESTED_GROWTH_AREAS } from './growthAreas'
import {
  addCustomGrowthArea,
  completeStep,
  createOnboardingDraft,
  ONBOARDING_STEPS,
  selectGrowthArea,
  type OnboardingDraft,
} from './onboardingDraft'
import {
  answeredSteps,
  isGrowthAreaStepValid,
  validateOnboardingDraft,
  type OnboardingProblem,
} from './onboardingValidation'

const T0 = '2026-10-01T09:00:00.000Z'

const FITNESS = SUGGESTED_GROWTH_AREAS.find((area) => area.id === 'ga_fitness')!
const READING = SUGGESTED_GROWTH_AREAS.find((area) => area.id === 'ga_reading')!

function withFitness(): OnboardingDraft {
  return selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T0)
}

/** Force a field, to build drafts that no honest UI could produce. */
function withField<K extends keyof OnboardingDraft>(
  draft: OnboardingDraft,
  key: K,
  value: OnboardingDraft[K],
): OnboardingDraft {
  return { ...draft, [key]: value }
}

function problemOf(result: ReturnType<typeof validateOnboardingDraft>): OnboardingProblem {
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
    // the data, never from the pointer.
    const draft = withField(withFitness(), 'currentStep', 'welcome')

    expect(failure(validateOnboardingDraft(draft)).problem).toBe('not-answered-yet')
    expect(failure(validateOnboardingDraft(draft)).firstIncompleteStep).toBe('goal')
  })

  it('reaches the first unbuilt step and says so honestly', () => {
    // Phase 2A has only a growth-area rule, so `goal` cannot be satisfied.
    // Reporting `not-answered-yet` rather than `unanswered` keeps our gap
    // clearly distinguishable from a user who skipped a question.
    const result = validateOnboardingDraft(withFitness())

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.firstIncompleteStep).toBe('goal')
    expect(result.problem).toBe('not-answered-yet')
    expect(result.message).toBe('The “goal” step has not been built yet, so onboarding cannot be completed.')
  })

  it('does not depend on a custom area any more than a suggested one', () => {
    const draft = addCustomGrowthArea(createOnboardingDraft(T0), { id: 'ga_x', name: 'Piano', normalizedName: 'piano' }, T0)

    expect(problemOf(validateOnboardingDraft(draft))).toBe('not-answered-yet')
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

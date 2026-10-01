import { describe, expect, it } from 'vitest'

import { suggestedGrowthAreaId } from '../../domain/growthAreaId'
import {
  addMilestone,
  completeStep,
  createOnboardingDraft,
  selectGrowthArea,
  setDailyEffortMinutes,
  setDurationDays,
  setGoal,
  setWhy,
} from '../../domain/onboardingDraft'
import type { OnboardingDraft } from '../../domain/onboardingDraft'
import { hasStartedOnboarding, resumePath, resumeStepInBuild } from './resume'

const T0 = '2026-10-01T09:00:00.000Z'
const FITNESS = suggestedGrowthAreaId('fitness')

function withAreas(): OnboardingDraft {
  return selectGrowthArea(createOnboardingDraft(T0), FITNESS, T0)
}

/** What `begin()` produces: a brand new draft, already moved off step 1. */
function justStarted(): OnboardingDraft {
  return completeStep(createOnboardingDraft(T0), 'welcome', T0)
}

function withAreasAndGoal(): OnboardingDraft {
  return completeStep(setGoal(withAreas(), 'Run my first 10K', T0), 'goal', T0)
}

function withWhyAnswered(): OnboardingDraft {
  return completeStep(setWhy(withAreasAndGoal(), 'Because I can', T0), 'why', T0)
}

function withDurationAnswered(): OnboardingDraft {
  return completeStep(setDurationDays(withWhyAnswered(), 30, T0), 'duration', T0)
}

function withMilestonesAnswered(): OnboardingDraft {
  const result = addMilestone(withDurationAnswered(), 'ms_first', 'Run 5 km', T0)
  if (!result.ok) throw new Error(result.message)
  return completeStep(result.draft, 'milestones', T0)
}

/** Every question this build asks, answered, and Continue pressed on Effort. */
function finished(): OnboardingDraft {
  return completeStep(setDailyEffortMinutes(withMilestonesAnswered(), 20, T0), 'daily-effort', T0)
}

describe('resumeStepInBuild', () => {
  it('sends a first-time visitor to the welcome screen', () => {
    expect(resumeStepInBuild(null)).toBe('welcome')
  })

  it('sends someone who has answered nothing to the first question', () => {
    // They pressed the button and closed the tab. Their draft exists, so
    // `draft !== null` is true — which is exactly the check this replaces.
    expect(resumeStepInBuild(justStarted())).toBe('growth-areas')
  })

  it('sends a Phase 2A draft forward instead of to a dead button', () => {
    // A real upgrade case, not a hypothetical one. Phase 2A's `begin()`
    // created a draft that still said `currentStep: 'welcome'`, so every
    // draft in the wild carries that pointer. Trusting it would make the
    // Continue button navigate to the page it is already on.
    expect(withAreas().currentStep).toBe('welcome')
    expect(resumeStepInBuild(withAreas())).toBe('goal')
  })

  it('sends someone back to the chips they answered but never confirmed', () => {
    // The alternative is jumping them to the Goal screen because a field
    // happens to be satisfied. Both are safe; asking again is the one
    // that is unsurprising.
    const draft = justStarted()
    const withSelection = selectGrowthArea(draft, FITNESS, T0)

    expect(withSelection.currentStep).toBe('growth-areas')
    expect(resumeStepInBuild(withSelection)).toBe('growth-areas')
  })

  it('resumes the Goal question when that is where they stopped', () => {
    expect(resumeStepInBuild(completeStep(withAreas(), 'growth-areas', T0))).toBe('goal')
  })

  it('resumes the WHY when the Goal is written and Continue was pressed', () => {
    expect(resumeStepInBuild(withAreasAndGoal())).toBe('why')
  })

  it('resumes the Duration when the WHY is written and Continue was pressed', () => {
    // Through Phase 2B this draft was sent back to the WHY, because
    // `duration` had no screen. Phase 2C built it, so the pointer is now
    // followed instead of clamped.
    expect(withWhyAnswered().currentStep).toBe('duration')
    expect(resumeStepInBuild(withWhyAnswered())).toBe('duration')
  })

  it('resumes the Milestones when the Duration is answered and Continue was pressed', () => {
    expect(withDurationAnswered().currentStep).toBe('milestones')
    expect(resumeStepInBuild(withDurationAnswered())).toBe('milestones')
  })

  it('resumes the Daily Effort when the Milestones are answered', () => {
    expect(withMilestonesAnswered().currentStep).toBe('daily-effort')
    expect(resumeStepInBuild(withMilestonesAnswered())).toBe('daily-effort')
  })

  it('never routes past the last screen this build has', () => {
    // Pressing Continue on Effort writes currentStep: 'summary'.
    // Phase 2D builds the Summary screen, so resume now follows the pointer.
    const complete = finished()

    expect(complete.currentStep).toBe('summary')
    expect(resumeStepInBuild(complete)).toBe('summary')
  })

  it('never resumes past a step whose own validator refuses it', () => {
    // Field presence is not validity. This is a draft whose WHY survived
    // and whose Goal did not — only possible by hand-editing storage or
    // by an older build dropping a field, which is precisely when it
    // matters most.
    const broken = { ...withAreasAndGoal(), goal: undefined }
    const draft: OnboardingDraft = { ...completeStep(broken, 'why', T0) }

    expect(resumeStepInBuild(draft)).toBe('goal')
  })

  it('sends an out-of-range stored Duration back to the Duration question', () => {
    // The pointer says milestones; the number says the answer is not usable.
    // Validity is read from the data, never from the pointer.
    const draft = setDurationDays(withWhyAnswered(), 500, T0)

    expect(draft.currentStep).toBe('duration')
    expect(resumeStepInBuild(draft)).toBe('duration')
  })

  it('sends a draft with an over-full milestone list back to the Milestones question', () => {
    const overfull = {
      ...withMilestonesAnswered(),
      milestones: Array.from({ length: 6 }, (_, index) => ({
        id: `ms_${index}`,
        text: `Milestone ${index}`,
      })),
    }

    expect(resumeStepInBuild(overfull)).toBe('milestones')
  })

  it('reports nothing as started for an unanswered draft', () => {
    expect(hasStartedOnboarding(null)).toBe(false)
    expect(hasStartedOnboarding(justStarted())).toBe(false)
    expect(hasStartedOnboarding(withAreas())).toBe(true)
  })
})

describe('resumePath', () => {
  it('maps every step this build can show to a real URL', () => {
    expect(resumePath(null)).toBe('/onboarding')
    expect(resumePath(justStarted())).toBe('/onboarding/areas')
    expect(resumePath(completeStep(withAreas(), 'growth-areas', T0))).toBe('/onboarding/goal')
    expect(resumePath(withAreasAndGoal())).toBe('/onboarding/why')
    expect(resumePath(withWhyAnswered())).toBe('/onboarding/duration')
    expect(resumePath(withDurationAnswered())).toBe('/onboarding/milestones')
    expect(resumePath(withMilestonesAnswered())).toBe('/onboarding/effort')
  })

  it('sends somebody past the end of the built path to the LAST built screen', () => {
    // `summary` is the last built step in Phase 2D.
    expect(resumePath(finished())).toBe('/onboarding/summary')
  })
})
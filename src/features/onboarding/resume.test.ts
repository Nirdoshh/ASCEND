import { describe, expect, it } from 'vitest'

import { suggestedGrowthAreaId } from '../../domain/growthAreaId'
import { completeStep, createOnboardingDraft, selectGrowthArea, setGoal } from '../../domain/onboardingDraft'
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

  it('never routes past the last screen this build has', () => {
    // Pressing Continue on the WHY writes currentStep: 'duration', which
    // has no URL. Following it would 404 immediately after a successful
    // looking answer.
    const finished = completeStep(withAreasAndGoal(), 'why', T0)
    expect(finished.currentStep).toBe('duration')
    expect(resumeStepInBuild(finished)).toBe('why')
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
  })
})
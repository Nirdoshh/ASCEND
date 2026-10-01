import { describe, expect, it } from 'vitest'

import { createOnboardingDraftRepository } from '../data/repositories/onboardingDraftRepository'
import { createJourneyRepository } from '../data/repositories/journeyRepository'
import { createWebStorageStore } from '../data/storage'
import { addMilestone, completeStep, createOnboardingDraft, selectGrowthArea, setDailyEffortMinutes, setDurationDays, setGoal, setWhy } from '../domain/onboardingDraft'
import { createJourneyFromDraft, type Journey } from '../domain/journey'
import { knownGrowthAreas } from '../domain/onboardingDraft'
import { suggestedGrowthAreaId } from '../domain/growthAreaId'
import { resolveStartupDestination, resolveTodayDestination } from './startup'

const T0 = '2026-10-01T09:00:00.000Z'
const FITNESS = suggestedGrowthAreaId('fitness')

function noStore() {
  return createWebStorageStore(null)
}

function localStore() {
  return createWebStorageStore()
}

function draftRepo(store = localStore()) {
  return createOnboardingDraftRepository(store)
}

function journeyRepo(store = localStore()) {
  return createJourneyRepository(store)
}

function freshDraft(): ReturnType<typeof createOnboardingDraft> {
  return createOnboardingDraft(T0)
}

function withAreas(): ReturnType<typeof createOnboardingDraft> {
  return selectGrowthArea(freshDraft(), FITNESS, T0)
}

function withAreasAndGoal(): ReturnType<typeof createOnboardingDraft> {
  return completeStep(setGoal(withAreas(), 'Run my first 10K', T0), 'growth-areas', T0)
}

function withWhy(): ReturnType<typeof createOnboardingDraft> {
  return completeStep(setWhy(withAreasAndGoal(), 'Because I can', T0), 'goal', T0)
}

function withDuration(): ReturnType<typeof createOnboardingDraft> {
  return completeStep(setDurationDays(withWhy(), 30, T0), 'why', T0)
}

function withMilestones(): ReturnType<typeof createOnboardingDraft> {
  const result = addMilestone(withDuration(), 'ms_first', 'Run 5 km', T0)
  if (!result.ok) throw new Error(result.message)
  return completeStep(result.draft, 'duration', T0)
}

function withEffort(): ReturnType<typeof createOnboardingDraft> {
  return completeStep(setDailyEffortMinutes(withMilestones(), 20, T0), 'milestones', T0)
}

function activeJourney(): Journey {
  const draft = withEffort()
  const areas = knownGrowthAreas(draft)
  return createJourneyFromDraft(
    {
      selectedGrowthAreaIds: draft.selectedGrowthAreaIds,
      customGrowthAreas: draft.customGrowthAreas,
      goal: draft.goal!,
      why: draft.why!,
      durationDays: draft.durationDays!,
      milestones: draft.milestones!,
      dailyEffortMinutes: draft.dailyEffortMinutes!,
    },
    areas,
    T0,
    'jr_test1234567890',
  )
}

describe('resolveStartupDestination', () => {
  it('CASE 1: active Journey exists → today', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    jr.save(activeJourney())

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('today')
  })

  it('CASE 2: no Journey, partial draft exists → correct resume step', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    // Draft with areas selected but not confirmed (currentStep still welcome)
    const draft = withAreas()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/goal')
    }
  })

  it('resumes at goal when growth-areas confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = withAreasAndGoal()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/goal')
    }
  })

  it('resumes at why when goal confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = withWhy()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/why')
    }
  })

  it('resumes at duration when why confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = withDuration()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/duration')
    }
  })

  it('resumes at milestones when duration confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = withMilestones()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/milestones')
    }
  })

  it('resumes at effort when milestones confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = withEffort()
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/effort')
    }
  })

  it('resumes at summary when effort confirmed', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const draft = completeStep(setDailyEffortMinutes(withMilestones(), 20, T0), 'daily-effort', T0)
    dr.save(draft)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/summary')
    }
  })

  it('CASE 3: no Journey and no draft → /onboarding', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding')
    if (result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding')
    }
  })

  it('Journey takes precedence over draft', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    jr.save(activeJourney())
    dr.save(withAreas()) // Draft exists but Journey should win

    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('today')
  })

  it('does not create data merely by resolving', () => {
    const store = noStore() // Storage unavailable
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    // Should not throw and should not write anything
    const result = resolveStartupDestination(jr, dr)

    expect(result.kind).toBe('onboarding')
    if (result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding')
    }
  })
})

describe('resolveTodayDestination', () => {
  it('active Journey → today', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    jr.save(activeJourney())

    const result = resolveTodayDestination(jr, dr)

    expect(result.kind).toBe('today')
  })

  it('no Journey, draft exists → onboarding-resume', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    dr.save(withAreas())

    const result = resolveTodayDestination(jr, dr)

    expect(result.kind).toBe('onboarding-resume')
    if (result.kind === 'onboarding-resume' || result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding/goal')
    }
  })

  it('no Journey, no draft → /onboarding', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const result = resolveTodayDestination(jr, dr)

    expect(result.kind).toBe('onboarding')
    if (result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding')
    }
  })

  it('Journey takes precedence over draft', () => {
    const store = localStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    jr.save(activeJourney())
    dr.save(withAreas())

    const result = resolveTodayDestination(jr, dr)

    expect(result.kind).toBe('today')
  })

  it('does not create data merely by resolving', () => {
    const store = noStore()
    const jr = journeyRepo(store)
    const dr = draftRepo(store)

    const result = resolveTodayDestination(jr, dr)

    expect(result.kind).toBe('onboarding')
    if (result.kind === 'onboarding') {
      expect(result.path).toBe('/onboarding')
    }
  })
})
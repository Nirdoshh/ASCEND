import { describe, expect, it } from 'vitest'

import { createCustomGrowthArea, SUGGESTED_GROWTH_AREAS } from './growthAreas'
import {
  addCustomGrowthArea,
  completeStep,
  createOnboardingDraft,
  deselectGrowthArea,
  isSelected,
  knownGrowthAreas,
  nextStep,
  normalizeCustomGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  reconcileSelections,
  selectGrowthArea,
  toggleGrowthArea,
  type CustomGrowthArea,
  type OnboardingDraft,
} from './onboardingDraft'

const T0 = '2026-10-01T09:00:00.000Z'
const T1 = '2026-10-01T09:05:00.000Z'
const T2 = '2026-10-01T09:10:00.000Z'

const PIANO: CustomGrowthArea = { id: 'piano', name: 'Piano' }

function draftWithPiano(): OnboardingDraft {
  return addCustomGrowthArea(createOnboardingDraft(T0), PIANO, T0)
}

describe('createOnboardingDraft', () => {
  it('starts empty, on the welcome step, with real timestamps', () => {
    const draft = createOnboardingDraft(T0)

    expect(draft).toEqual({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      currentStep: 'welcome',
      selectedGrowthAreas: [],
      customGrowthAreas: [],
      startedAt: T0,
      updatedAt: T0,
    })
  })

  it('has no goal, why, duration, milestone or effort field at all', () => {
    // Structural guarantee: an unanswered question cannot be stored as
    // "", because there is nowhere to put it. See the file comment.
    const draft = createOnboardingDraft(T0)

    for (const key of ['goal', 'why', 'durationDays', 'milestones', 'dailyEffortMinutes']) {
      expect(draft).not.toHaveProperty(key)
    }
  })
})

describe('selecting and deselecting', () => {
  it('selects a suggested area and remembers when it changed', () => {
    const draft = selectGrowthArea(createOnboardingDraft(T0), 'fitness', T1)

    expect(isSelected(draft, 'fitness')).toBe(true)
    expect(draft.selectedGrowthAreas).toEqual(['fitness'])
    expect(draft.updatedAt).toBe(T1)
    expect(draft.startedAt).toBe(T0)
  })

  it('keeps the order the user chose in', () => {
    let draft = createOnboardingDraft(T0)
    draft = selectGrowthArea(draft, 'reading', T1)
    draft = selectGrowthArea(draft, 'fitness', T2)

    expect(draft.selectedGrowthAreas).toEqual(['reading', 'fitness'])
  })

  it('ignores a second selection of the same area', () => {
    const once = selectGrowthArea(createOnboardingDraft(T0), 'fitness', T1)
    const twice = selectGrowthArea(once, 'fitness', T2)

    expect(twice).toBe(once)
  })

  it('deselects an area', () => {
    const selected = selectGrowthArea(createOnboardingDraft(T0), 'fitness', T1)
    const cleared = deselectGrowthArea(selected, 'fitness', T2)

    expect(isSelected(cleared, 'fitness')).toBe(false)
    expect(cleared.selectedGrowthAreas).toEqual([])
  })

  it('toggles on and back off', () => {
    const base = createOnboardingDraft(T0)
    const on = toggleGrowthArea(base, 'fitness', T1)
    const off = toggleGrowthArea(on, 'fitness', T2)

    expect(isSelected(on, 'fitness')).toBe(true)
    expect(isSelected(off, 'fitness')).toBe(false)
  })

  it('ignores an id that names no known area', () => {
    const base = createOnboardingDraft(T0)

    // A stale link or hand-edited storage must not be able to create a
    // selection that the UI can never display.
    expect(toggleGrowthArea(base, 'not-a-real-area', T1)).toBe(base)
    expect(selectGrowthArea(base, 'not-a-real-area', T1)).toBe(base)
  })
})

describe('deselecting never destroys other work', () => {
  it('keeps the custom area definition when the area is deselected', () => {
    const draft = draftWithPiano()
    const after = deselectGrowthArea(draft, 'piano', T1)

    expect(after.customGrowthAreas).toEqual([PIANO])
    expect(after.selectedGrowthAreas).toEqual([])
    // The area is still offered on the screen, just unchosen.
    expect(knownGrowthAreas(after).some((area) => area.id === 'piano')).toBe(true)
  })

  it('re-selecting an area that was deselected brings it back with its name intact', () => {
    const draft = draftWithPiano()
    const after = deselectGrowthArea(draft, 'piano', T1)
    const back = selectGrowthArea(after, 'piano', T2)

    expect(back.selectedGrowthAreas).toEqual(['piano'])
    expect(knownGrowthAreas(back).find((area) => area.id === 'piano')?.name).toBe('Piano')
  })

  it('changes nothing except the selection list and the timestamp', () => {
    let draft = draftWithPiano()
    draft = selectGrowthArea(draft, 'fitness', T1)
    draft = completeStep(draft, 'growth-areas', T1)
    const before = draft

    const after = deselectGrowthArea(before, 'piano', T2)

    // Every field other than the selection list is byte-for-byte the
    // same object. If this test ever fails, a toggle has started
    // destroying something.
    expect(after.schemaVersion).toBe(before.schemaVersion)
    expect(after.currentStep).toBe(before.currentStep)
    expect(after.customGrowthAreas).toEqual(before.customGrowthAreas)
    expect(after.startedAt).toBe(before.startedAt)
    expect(after.selectedGrowthAreas).not.toEqual(before.selectedGrowthAreas)
  })

  it('leaves other selections alone when one is deselected', () => {
    let draft = draftWithPiano()
    draft = selectGrowthArea(draft, 'fitness', T1)
    draft = selectGrowthArea(draft, 'reading', T1)

    const after = deselectGrowthArea(draft, 'fitness', T2)

    expect(after.selectedGrowthAreas).toEqual(['piano', 'reading'])
  })
})

describe('custom growth areas', () => {
  it('creates and selects in one step', () => {
    const result = createCustomGrowthArea('Piano', [])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const draft = addCustomGrowthArea(createOnboardingDraft(T0), result.area, T1)

    expect(draft.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
    expect(draft.selectedGrowthAreas).toEqual(['piano'])
  })

  it('is a no-op when the same area already exists, keeping the first spelling', () => {
    const first = draftWithPiano()
    const again = addCustomGrowthArea(first, { id: 'piano', name: 'PIANO' }, T1)

    expect(again).toBe(first)
    expect(again.customGrowthAreas[0]?.name).toBe('Piano')
  })

  it('behaves exactly like a suggested area once created', () => {
    const draft = draftWithPiano()
    const known = knownGrowthAreas(draft)

    const piano = known.find((area) => area.id === 'piano')
    const fitness = known.find((area) => area.id === 'fitness')

    // Same shape, same size, same place in the list, and it toggles
    // through the same function with no special case anywhere.
    expect(Object.keys(piano ?? {}).sort()).toEqual(Object.keys(fitness ?? {}).sort())
    expect(isSelected(draft, 'piano')).toBe(true)
    expect(toggleGrowthArea(draft, 'piano', T1).selectedGrowthAreas).toEqual([])
  })

  it('lists all ten suggestions plus the custom ones', () => {
    expect(knownGrowthAreas(createOnboardingDraft(T0))).toHaveLength(10)
    expect(knownGrowthAreas(draftWithPiano())).toHaveLength(11)
  })
})

describe('reconcileSelections', () => {
  it('drops selections that name an unknown area', () => {
    const draft: OnboardingDraft = {
      ...selectGrowthArea(createOnboardingDraft(T0), 'fitness', T0),
      selectedGrowthAreas: ['fitness', 'removed-in-a-later-build'],
    }

    expect(reconcileSelections(draft).selectedGrowthAreas).toEqual(['fitness'])
  })

  it('leaves a healthy draft exactly as it found it', () => {
    const draft = draftWithPiano()

    expect(reconcileSelections(draft)).toBe(draft)
  })

  it('never removes a custom area definition', () => {
    const draft: OnboardingDraft = {
      ...createOnboardingDraft(T0),
      selectedGrowthAreas: ['ghost'],
      customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
    }

    const reconciled = reconcileSelections(draft)

    expect(reconciled.selectedGrowthAreas).toEqual([])
    expect(reconciled.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
  })
})

describe('steps', () => {
  it('lists the steps in order with welcome first and summary last', () => {
    expect(ONBOARDING_STEPS[0]).toBe('welcome')
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('summary')
  })

  it('advances to the following step', () => {
    expect(nextStep('welcome')).toBe('growth-areas')
    expect(nextStep('growth-areas')).toBe('goal')
  })

  it('has no step after the last one', () => {
    expect(nextStep('summary')).toBeUndefined()
  })

  it('records the step the user has reached', () => {
    const draft = completeStep(createOnboardingDraft(T0), 'growth-areas', T1)

    expect(draft.currentStep).toBe('goal')
    expect(draft.updatedAt).toBe(T1)
  })

  it('does not advance past the final step', () => {
    const draft = completeStep(createOnboardingDraft(T0), 'summary', T1)

    expect(draft.currentStep).toBe('welcome')
    expect(draft.updatedAt).toBe(T0)
  })
})

describe('normalizeCustomGrowthArea', () => {
  it('re-derives the id from the stored name instead of trusting it', () => {
    const area = normalizeCustomGrowthArea({ id: 'something-else-entirely', name: '  Piano  ' })

    expect(area).toEqual({ id: 'piano', name: 'Piano' })
  })

  it('preserves the stored capitalization', () => {
    expect(normalizeCustomGrowthArea({ name: 'PIANO' })).toEqual({ id: 'piano', name: 'PIANO' })
  })

  it('rejects values that are not usable areas', () => {
    for (const value of [null, undefined, 42, 'Piano', {}, { name: '' }, { name: '   ' }]) {
      expect(normalizeCustomGrowthArea(value)).toBeNull()
    }
  })
})

describe('suggested areas stay suggestions', () => {
  it('does not let a custom area change the suggestion list', () => {
    // The suggestions live in code and are never written to the draft,
    // so the draft cannot drift away from the shipped list.
    const draft = draftWithPiano()

    expect(draft.customGrowthAreas).not.toContainEqual(
      expect.objectContaining({ kind: 'suggested' }),
    )
    expect(SUGGESTED_GROWTH_AREAS).toHaveLength(10)
  })
})
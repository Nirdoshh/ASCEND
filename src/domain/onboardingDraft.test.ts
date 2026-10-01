import { describe, expect, it } from 'vitest'

import { migratedGrowthAreaId, suggestedGrowthAreaId } from './growthAreaId'
import { normalizeGrowthAreaName } from './growthAreaName'
import { createCustomGrowthArea, SUGGESTED_GROWTH_AREAS } from './growthAreas'
import {
  addCustomGrowthArea,
  completeStep,
  createOnboardingDraft,
  deselectGrowthArea,
  isSelected,
  knownGrowthAreas,
  nextStep,
  normalizeDraftGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  reconcileSelections,
  renameCustomGrowthArea,
  resumeStep,
  selectGrowthArea,
  toggleGrowthArea,
  type DraftGrowthArea,
  type OnboardingDraft,
} from './onboardingDraft'

const T0 = '2026-10-01T09:00:00.000Z'
const T1 = '2026-10-01T09:05:00.000Z'
const T2 = '2026-10-01T09:10:00.000Z'

/** Opaque-looking and name-free, so no test can pass by accident. */
const PIANO_ID = 'ga_c_pianofixed01'

const PIANO: DraftGrowthArea = {
  id: PIANO_ID,
  name: 'Piano',
  normalizedName: 'piano',
}

/**
 * A suggested area, looked up by the id it ships with.
 *
 * Written as a throwing lookup rather than `find(...)!` so that renaming a
 * suggested id fails with "no such area: ga_s_fitness" instead of
 * "cannot read properties of undefined", which tells you nothing about which
 * of the several ids in these tests went missing.
 */
function suggested(id: string) {
  const area = SUGGESTED_GROWTH_AREAS.find((candidate) => candidate.id === id)

  if (!area) throw new Error(`no such suggested Growth Area: ${id}`)
  return area
}

const FITNESS = suggested(suggestedGrowthAreaId('fitness'))
const READING = suggested(suggestedGrowthAreaId('reading'))

function draftWithPiano(): OnboardingDraft {
  return addCustomGrowthArea(createOnboardingDraft(T0), PIANO, T0)
}

describe('createOnboardingDraft', () => {
  it('starts empty, on the welcome step, with real timestamps', () => {
    const draft = createOnboardingDraft(T0)

    expect(draft).toEqual({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      currentStep: 'welcome',
      selectedGrowthAreaIds: [],
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

  it('stores references by id, never by name', () => {
    // The field name says ids and the values are ids. A future milestone
    // or D1 row reading `selectedGrowthAreaIds` cannot be misled into
    // treating an entry as a display name.
    const draft = selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T1)

    expect(draft.selectedGrowthAreaIds.every((id) => id.startsWith('ga_'))).toBe(true)
  })
})

describe('selecting and deselecting', () => {
  it('selects a suggested area and remembers when it changed', () => {
    const draft = selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T1)

    expect(isSelected(draft, FITNESS.id)).toBe(true)
    expect(draft.selectedGrowthAreaIds).toEqual([FITNESS.id])
    expect(draft.updatedAt).toBe(T1)
    expect(draft.startedAt).toBe(T0)
  })

  it('keeps the order the user chose in', () => {
    let draft = createOnboardingDraft(T0)
    draft = selectGrowthArea(draft, READING.id, T1)
    draft = selectGrowthArea(draft, FITNESS.id, T2)

    expect(draft.selectedGrowthAreaIds).toEqual([READING.id, FITNESS.id])
  })

  it('ignores a second selection of the same area', () => {
    const once = selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T1)
    const twice = selectGrowthArea(once, FITNESS.id, T2)

    expect(twice).toBe(once)
  })

  it('deselects an area', () => {
    const selected = selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T1)
    const cleared = deselectGrowthArea(selected, FITNESS.id, T2)

    expect(isSelected(cleared, FITNESS.id)).toBe(false)
    expect(cleared.selectedGrowthAreaIds).toEqual([])
  })

  it('toggles on and back off', () => {
    const base = createOnboardingDraft(T0)
    const on = toggleGrowthArea(base, FITNESS.id, T1)
    const off = toggleGrowthArea(on, FITNESS.id, T2)

    expect(isSelected(on, FITNESS.id)).toBe(true)
    expect(isSelected(off, FITNESS.id)).toBe(false)
  })

  it('ignores an id that names no known area', () => {
    const base = createOnboardingDraft(T0)

    // A stale link or hand-edited storage must not be able to create a
    // selection that the UI can never display.
    for (const bogus of ['not-a-real-area', 'fitness', 'piano', 'ga_fitness ', '']) {
      expect(toggleGrowthArea(base, bogus, T1)).toBe(base)
      expect(selectGrowthArea(base, bogus, T1)).toBe(base)
    }
  })

  it('no longer accepts a bare normalized name as an id', () => {
    // The exact call the Phase 2A bug invited. "fitness" was an id in
    // Phase 2A; now it is just a name, and passing one is a no-op.
    const base = createOnboardingDraft(T0)

    expect(selectGrowthArea(base, 'fitness', T1)).toBe(base)
  })
})

describe('deselecting never destroys other work', () => {
  it('keeps the custom area definition when the area is deselected', () => {
    const draft = draftWithPiano()
    const after = deselectGrowthArea(draft, PIANO_ID, T1)

    expect(after.customGrowthAreas).toEqual([PIANO])
    expect(after.selectedGrowthAreaIds).toEqual([])
    // The area is still offered on the screen, just unchosen.
    expect(knownGrowthAreas(after).some((area) => area.id === PIANO_ID)).toBe(true)
  })

  it('re-selecting an area that was deselected brings it back with its name intact', () => {
    const draft = draftWithPiano()
    const after = deselectGrowthArea(draft, PIANO_ID, T1)
    const back = selectGrowthArea(after, PIANO_ID, T2)

    expect(back.selectedGrowthAreaIds).toEqual([PIANO_ID])
    expect(knownGrowthAreas(back).find((area) => area.id === PIANO_ID)?.name).toBe('Piano')
  })

  it('changes nothing except the selection list and the timestamp', () => {
    let draft = draftWithPiano()
    draft = selectGrowthArea(draft, FITNESS.id, T1)
    draft = completeStep(draft, 'growth-areas', T1)
    const before = draft

    const after = deselectGrowthArea(before, PIANO_ID, T2)

    // Every field other than the selection list is byte-for-byte the
    // same object. If this test ever fails, a toggle has started
    // destroying something.
    expect(after.schemaVersion).toBe(before.schemaVersion)
    expect(after.currentStep).toBe(before.currentStep)
    expect(after.customGrowthAreas).toEqual(before.customGrowthAreas)
    expect(after.startedAt).toBe(before.startedAt)
    expect(after.selectedGrowthAreaIds).not.toEqual(before.selectedGrowthAreaIds)
  })

  it('leaves other selections alone when one is deselected', () => {
    let draft = draftWithPiano()
    draft = selectGrowthArea(draft, FITNESS.id, T1)
    draft = selectGrowthArea(draft, READING.id, T1)

    const after = deselectGrowthArea(draft, FITNESS.id, T2)

    expect(after.selectedGrowthAreaIds).toEqual([PIANO_ID, READING.id])
  })
})

describe('renaming never changes identity', () => {
  it('keeps the same id when the name changes', () => {
    // The rule that the whole id/name split exists to protect: a rename
    // moves the label and nothing else, so every future reference to this
    // area — milestones, actions, point events, reviews, D1 rows — still
    // resolves.
    const result = renameCustomGrowthArea(draftWithPiano(), PIANO_ID, 'Grand Piano', T1)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const area = result.draft.customGrowthAreas[0]
    expect(area?.id).toBe(PIANO_ID)
    expect(area?.name).toBe('Grand Piano')
    expect(area?.normalizedName).toBe('grand piano')
    expect(result.draft.selectedGrowthAreaIds).toEqual([PIANO_ID])
  })

  it('leaves the selection alone, because it is the same area', () => {
    // Renaming is not changing your mind about working on something.
    const result = renameCustomGrowthArea(draftWithPiano(), PIANO_ID, 'Grand Piano', T1)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(isSelected(result.draft, PIANO_ID)).toBe(true)
  })

  it('lets an area be renamed repeatedly without its id drifting', () => {
    let draft = draftWithPiano()
    for (const name of ['Grand Piano', 'Piano Tuning', 'PIANO', 'Hammered Piano']) {
      const result = renameCustomGrowthArea(draft, PIANO_ID, name, T1)
      expect(result.ok, `expected “${name}” to be accepted`).toBe(true)
      if (!result.ok) return
      draft = result.draft
    }

    expect(draft.customGrowthAreas[0]?.id).toBe(PIANO_ID)
    expect(draft.customGrowthAreas[0]?.name).toBe('Hammered Piano')
  })

  it('refuses a name that collides with another area', () => {
    const withFitness = selectGrowthArea(draftWithPiano(), FITNESS.id, T1)

    for (const name of ['Fitness', 'fitness', 'FITNESS', ' fitness ']) {
      const result = renameCustomGrowthArea(withFitness, PIANO_ID, name, T1)
      expect(result.ok, `expected “${name}” to collide`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('duplicate')
    }
  })

  it('refuses a rename onto another custom area’s name', () => {
    const twoAreas = addCustomGrowthArea(
      draftWithPiano(),
      { id: 'ga_other', name: 'Guitar', normalizedName: 'guitar' },
      T1,
    )

    const result = renameCustomGrowthArea(twoAreas, PIANO_ID, 'guitar', T1)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('duplicate')
    expect(result.message).toBe('You already added “Guitar”.')
  })

  it('allows a rename to the area’s own current name', () => {
    const result = renameCustomGrowthArea(draftWithPiano(), PIANO_ID, '  PIANO  ', T1)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.customGrowthAreas[0]).toEqual({
      id: PIANO_ID,
      name: 'PIANO',
      normalizedName: 'piano',
    })
  })

  it('applies the same name rules as creation', () => {
    for (const [raw, problem] of [
      ['', 'empty'],
      ['   ', 'empty'],
      ['A'.repeat(61), 'too-long'],
      ['!!!', 'no-words'],
    ] as const) {
      const result = renameCustomGrowthArea(draftWithPiano(), PIANO_ID, raw, T1)
      expect(result.ok, `expected “${raw}” to be refused`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe(problem)
    }
  })

  it('reports a rename of an area that does not exist', () => {
    const result = renameCustomGrowthArea(createOnboardingDraft(T0), 'ga_missing', 'Anything', T1)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('not-found')
    expect(result.message).toBe('That area is no longer here.')
  })

  it('refuses to rename a suggested area, because it is not stored in the draft', () => {
    const result = renameCustomGrowthArea(createOnboardingDraft(T0), FITNESS.id, 'Gym', T1)

    expect(result.ok).toBe(false)
  })
})

describe('custom growth areas', () => {
  it('creates and selects in one step', () => {
    const result = createCustomGrowthArea('Piano', [], 'ga_mintedbycaller')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const draft = addCustomGrowthArea(createOnboardingDraft(T0), result.area, T1)

    expect(draft.customGrowthAreas).toEqual([
      { id: 'ga_mintedbycaller', name: 'Piano', normalizedName: 'piano' },
    ])
    expect(draft.selectedGrowthAreaIds).toEqual(['ga_mintedbycaller'])
  })

  it('stores the caller’s id verbatim and never re-derives it', () => {
    const draft = addCustomGrowthArea(createOnboardingDraft(T0), { ...PIANO, id: 'ga_zzz9' }, T1)

    expect(draft.customGrowthAreas[0]?.id).toBe('ga_zzz9')
  })

  it('is a no-op when the same identity already exists, keeping the first spelling', () => {
    const first = draftWithPiano()
    const again = addCustomGrowthArea(first, { ...PIANO, name: 'PIANO' }, T1)

    expect(again).toBe(first)
    expect(again.customGrowthAreas[0]?.name).toBe('Piano')
  })

  it('behaves exactly like a suggested area once created', () => {
    const draft = draftWithPiano()
    const known = knownGrowthAreas(draft)

    const piano = known.find((area) => area.id === PIANO_ID)
    const fitness = known.find((area) => area.id === FITNESS.id)

    // Same shape, same place in the list, and it toggles through the same
    // function with no special case anywhere.
    expect(Object.keys(piano ?? {}).sort()).toEqual(Object.keys(fitness ?? {}).sort())
    expect(isSelected(draft, PIANO_ID)).toBe(true)
    expect(toggleGrowthArea(draft, PIANO_ID, T1).selectedGrowthAreaIds).toEqual([])
  })

  it('lists all ten suggestions plus the custom ones', () => {
    expect(knownGrowthAreas(createOnboardingDraft(T0))).toHaveLength(10)
    expect(knownGrowthAreas(draftWithPiano())).toHaveLength(11)
  })
})

describe('reconcileSelections', () => {
  it('drops selections that name an unknown area', () => {
    const draft: OnboardingDraft = {
      ...selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T0),
      selectedGrowthAreaIds: [FITNESS.id, 'ga_retiredina-later-build'],
    }

    expect(reconcileSelections(draft).selectedGrowthAreaIds).toEqual([FITNESS.id])
  })

  it('drops a selection that holds a name rather than an id', () => {
    const draft: OnboardingDraft = {
      ...createOnboardingDraft(T0),
      selectedGrowthAreaIds: ['fitness'],
    }

    expect(reconcileSelections(draft).selectedGrowthAreaIds).toEqual([])
  })

  it('leaves a healthy draft exactly as it found it', () => {
    const draft = draftWithPiano()

    expect(reconcileSelections(draft)).toBe(draft)
  })

  it('never removes a custom area definition', () => {
    const draft: OnboardingDraft = {
      ...createOnboardingDraft(T0),
      selectedGrowthAreaIds: ['ga_ghost'],
      customGrowthAreas: [PIANO],
    }

    const reconciled = reconcileSelections(draft)

    expect(reconciled.selectedGrowthAreaIds).toEqual([])
    expect(reconciled.customGrowthAreas).toEqual([PIANO])
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

describe('resumeStep', () => {
  it('sends a first-time visitor to the welcome screen', () => {
    expect(resumeStep(null)).toBe('welcome')
  })

  it('sends a returning visitor back to where they stopped', () => {
    const draft = completeStep(selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T1), 'growth-areas', T1)

    expect(resumeStep(draft)).toBe('goal')
  })

  it('is a navigation helper only, and knows nothing about validity', () => {
    // currentStep is "goal" here while nothing has actually been
    // answered. resumeStep faithfully reports it, which is its whole job —
    // it must not be used as evidence that the user got that far
    // legitimately. See onboardingValidation.ts.
    const draft: OnboardingDraft = {
      ...createOnboardingDraft(T0),
      currentStep: 'goal',
    }

    expect(resumeStep(draft)).toBe('goal')
  })
})

describe('normalizeDraftGrowthArea', () => {
  it('TRUSTS the stored id, because identity is the one thing never re-derived', () => {
    // The inverse of Phase 2A's rule. Re-deriving an id from a name here
    // would re-break every reference the moment a user renamed something.
    const area = normalizeDraftGrowthArea({ id: 'ga_totallyopaque1', name: '  Piano  ' })

    expect(area).toEqual({ id: 'ga_totallyopaque1', name: 'Piano', normalizedName: 'piano' })
  })

  it('never trusts a stored normalizedName, because it is derived data', () => {
    const area = normalizeDraftGrowthArea({
      id: 'ga_fixed01',
      name: 'Piano',
      normalizedName: 'a stale value that would break duplicate detection',
    })

    expect(area?.normalizedName).toBe(normalizeGrowthAreaName('Piano'))
  })

  it('preserves the stored capitalization', () => {
    expect(normalizeDraftGrowthArea({ id: 'ga_x', name: 'PIANO' })).toEqual({
      id: 'ga_x',
      name: 'PIANO',
      normalizedName: 'piano',
    })
  })

  it('accepts an id in an unexpected format rather than dropping the area', () => {
    // Rejecting an id we do not recognise would silently delete a user's
    // growth area. Carrying it in an odd shape costs nothing.
    expect(normalizeDraftGrowthArea({ id: 'legacy_piano', name: 'Piano' })?.id).toBe('legacy_piano')
  })

  it('derives a deterministic id when the stored one is missing or blank', () => {
    // Not random: repairing the same draft twice must produce the same
    // repair, or references would break on every page load.
    for (const value of [{ name: 'Piano' }, { id: '', name: 'Piano' }, { id: '   ', name: 'Piano' }]) {
      const area = normalizeDraftGrowthArea(value)
      expect(area?.id).toBe(migratedGrowthAreaId('piano'))
    }
  })

  it('trims a stored id that has stray whitespace', () => {
    expect(normalizeDraftGrowthArea({ id: '  ga_fixed01  ', name: 'Piano' })?.id).toBe('ga_fixed01')
  })

  it('rejects values that are not usable areas', () => {
    for (const value of [null, undefined, 42, 'Piano', {}, { name: '' }, { name: '   ' }]) {
      expect(normalizeDraftGrowthArea(value)).toBeNull()
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

  it('never persists the kind, because which list it came from already says it', () => {
    const draft = draftWithPiano()

    for (const area of draft.customGrowthAreas) {
      expect(area).not.toHaveProperty('kind')
    }
  })
})

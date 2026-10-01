import { describe, expect, it } from 'vitest'

import { migratedGrowthAreaId, suggestedGrowthAreaId } from './growthAreaId'
import { normalizeGrowthAreaName } from './growthAreaName'
import { createCustomGrowthArea, SUGGESTED_GROWTH_AREAS } from './growthAreas'
import { MAX_MILESTONES } from './milestone'
import {
  addCustomGrowthArea,
  addMilestone,
  completeStep,
  createOnboardingDraft,
  deselectGrowthArea,
  editMilestone,
  hasAnsweredMilestones,
  isSelected,
  knownGrowthAreas,
  milestoneCount,
  nextStep,
  normalizeDraftGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  reconcileSelections,
  removeMilestone,
  renameCustomGrowthArea,
  resumeStep,
  selectGrowthArea,
  setDailyEffortMinutes,
  setDurationDays,
  setGoal,
  setWhy,
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

describe('recording the goal and the why', () => {
  it('stores a sentence, trimmed at the ends only', () => {
    const draft = setGoal(createOnboardingDraft(T0), '  Run my first 10K  ', T1)

    expect(draft.goal).toEqual({ text: 'Run my first 10K' })
    expect(draft.updatedAt).toBe(T1)
    expect(draft.startedAt).toBe(T0)
  })

  it('REMOVES the field when the box is emptied, instead of storing a blank', () => {
    // `goal: ''` would claim the user answered with nothing, which is a
    // different and false statement from "not asked yet".
    const withAnswer = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T1)
    const cleared = setGoal(withAnswer, '', T2)

    expect('goal' in cleared).toBe(false)
    expect(cleared).not.toHaveProperty('goal')
    expect(cleared.updatedAt).toBe(T2)
  })

  it('removes the field when the box holds only whitespace', () => {
    const withAnswer = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T1)
    const cleared = setGoal(withAnswer, '   \n  ', T2)

    expect(cleared).not.toHaveProperty('goal')
  })

  it('leaves the draft untouched when a blank replaces a blank', () => {
    // Identity matters: OnboardingDraftProvider uses it to skip a storage
    // write, so returning a fresh object here would rewrite localStorage
    // on every keystroke that changes nothing.
    const draft = createOnboardingDraft(T0)

    expect(setGoal(draft, '', T1)).toBe(draft)
  })

  it('leaves the draft untouched when the trimmed text has not changed', () => {
    // The user pressed space then backspace, or typed inside a run of
    // spaces. Nothing they can see changed, so nothing is written.
    const draft = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T1)

    expect(setGoal(draft, '  Run my first 10K  ', T2)).toBe(draft)
  })

  it('does change the draft when internal spacing changes', () => {
    // The opposite of the case above, and the reason the identity check
    // is on the TRIMMED text rather than the raw one.
    const draft = setGoal(createOnboardingDraft(T0), 'Run.  Walk.', T1)

    expect(setGoal(draft, 'Run. Walk.', T2)).not.toBe(draft)
  })

  it('never writes a blank answer, whatever it is given', () => {
    // One property, three inputs. If a future edit reintroduced an empty
    // branch, this is what catches it.
    for (const blank of ['', ' ', '\n\n', ' \t \n ']) {
      const draft = setGoal(createOnboardingDraft(T0), blank, T1)
      expect('goal' in draft, JSON.stringify(blank)).toBe(false)
    }
  })

  it('stores the why with exactly the same rules', () => {
    const draft = setWhy(createOnboardingDraft(T0), '  Because I can.  ', T1)

    expect(draft.why).toEqual({ text: 'Because I can.' })

    // Same trimming, same "identical text is not a change", same removal
    // rather than blanking.
    expect(setWhy(draft, ' Because I can. ', T2)).toBe(draft)
    expect(setWhy(draft, '   ', T2)).not.toHaveProperty('why')
  })

  it('keeps the two answers completely independent', () => {
    let draft = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T1)
    draft = setWhy(draft, 'Because I want to prove I can', T2)

    expect(draft.goal).toEqual({ text: 'Run my first 10K' })
    expect(draft.why).toEqual({ text: 'Because I want to prove I can' })

    // Clearing one must not touch the other. They answer different
    // questions, and a user rewriting their Goal has not changed their
    // reason for starting.
    const goalCleared = setGoal(draft, '', T2)
    expect(goalCleared).not.toHaveProperty('goal')
    expect(goalCleared.why).toEqual({ text: 'Because I want to prove I can' })

    const whyCleared = setWhy(draft, '  ', T2)
    expect(whyCleared.goal).toEqual({ text: 'Run my first 10K' })
    expect(whyCleared).not.toHaveProperty('why')
  })

  it('touches nothing else in the draft', () => {
    const base = selectGrowthArea(
      addCustomGrowthArea(createOnboardingDraft(T0), PIANO, T0),
      FITNESS.id,
      T0,
    )
    const withAnswer = setGoal(base, 'Run my first 10K', T1)

    expect(withAnswer.selectedGrowthAreaIds).toEqual(base.selectedGrowthAreaIds)
    expect(withAnswer.customGrowthAreas).toEqual(base.customGrowthAreas)
    expect(withAnswer.schemaVersion).toBe(base.schemaVersion)
    expect(withAnswer.currentStep).toBe(base.currentStep)
    expect(withAnswer.startedAt).toBe(base.startedAt)
    // Purely additive: nothing in the Phase 2A shape is rewritten, and
    // every answer set above is still readable.
    expect(withAnswer).toEqual({
      ...base,
      goal: { text: 'Run my first 10K' },
      updatedAt: T1,
    })
  })

  it('survives a Growth Area being deselected, because it names no area', () => {
    // ADR 0010. The Goal is a Journey-level answer, so there is no
    // reference for a deselection to break — which is why deselecting
    // cannot destroy it and why `reconcileSelections` needs no knowledge
    // of it at all.
    const withAnswer = setGoal(selectGrowthArea(createOnboardingDraft(T0), FITNESS.id, T0), 'Run my first 10K', T1)
    const deselected = reconcileSelections(toggleGrowthArea(withAnswer, FITNESS.id, T2))

    expect(deselected.selectedGrowthAreaIds).toEqual([])
    expect(deselected.goal).toEqual({ text: 'Run my first 10K' })
  })

  it('does not change the step, which is navigation and nothing else', () => {
    const draft = setGoal(createOnboardingDraft(T0), 'Run my first 10K', T1)

    expect(draft.currentStep).toBe('welcome')
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

describe('the Duration answer', () => {
  it('starts absent, so an unanswered question has one representation', () => {
    expect(createOnboardingDraft(T0).durationDays).toBeUndefined()
    expect('durationDays' in createOnboardingDraft(T0)).toBe(false)
  })

  it('stores a positive whole number and stamps the time', () => {
    const draft = setDurationDays(createOnboardingDraft(T0), 30, T1)

    expect(draft.durationDays).toBe(30)
    expect(draft.updatedAt).toBe(T1)
    expect(draft.startedAt).toBe(T0)
  })

  it('deletes the field for an absent answer rather than storing undefined', () => {
    const answered = setDurationDays(createOnboardingDraft(T0), 30, T1)
    const cleared = setDurationDays(answered, undefined, T2)

    expect('durationDays' in cleared).toBe(false)
    expect(cleared.updatedAt).toBe(T2)
  })

  it('deletes the field for zero, a negative or a fraction rather than storing it', () => {
    // Each of these is a thing an empty or misused number input produces.
    // None of them is a duration, and the field does not exist to hold one.
    for (const value of [0, -30, 30.5, NaN, Infinity]) {
      const answered = setDurationDays(createOnboardingDraft(T0), 30, T1)
      const cleared = setDurationDays(answered, value, T2)

      expect('durationDays' in cleared, String(value)).toBe(false)
    }
  })

  it('stores an out-of-range number rather than clamping or dropping it', () => {
    // 500 cannot come from our screens. It can come from hand-edited storage
    // or a build with different bounds, and the honest reading is that
    // somebody answered 500. The step validator refuses the step; this layer
    // does not throw the answer away.
    expect(setDurationDays(createOnboardingDraft(T0), 500, T1).durationDays).toBe(500)
    expect(setDurationDays(createOnboardingDraft(T0), 1, T1).durationDays).toBe(1)
  })

  it('returns the identical draft for the same number, so re-picking costs no write', () => {
    const answered = setDurationDays(createOnboardingDraft(T0), 30, T1)

    expect(setDurationDays(answered, 30, T2)).toBe(answered)
  })

  it('returns the identical draft when clearing an already-absent field', () => {
    const draft = createOnboardingDraft(T0)

    expect(setDurationDays(draft, undefined, T1)).toBe(draft)
  })

  it('leaves currentStep alone, because an answer is not a position', () => {
    const draft = completeStep(createOnboardingDraft(T0), 'why', T0)
    const answered = setDurationDays(draft, 30, T1)

    expect(answered.currentStep).toBe('duration')
  })
})

describe('the Daily Effort answer', () => {
  it('starts absent', () => {
    expect('dailyEffortMinutes' in createOnboardingDraft(T0)).toBe(false)
  })

  it('stores a positive whole number of minutes', () => {
    expect(setDailyEffortMinutes(createOnboardingDraft(T0), 20, T1).dailyEffortMinutes).toBe(20)
  })

  it('deletes the field for zero, a negative, a fraction or an absence', () => {
    for (const value of [0, -20, 20.5, NaN, Infinity, undefined]) {
      const answered = setDailyEffortMinutes(createOnboardingDraft(T0), 20, T1)
      const cleared = setDailyEffortMinutes(answered, value, T2)

      expect('dailyEffortMinutes' in cleared, String(value)).toBe(false)
    }
  })

  it('is an independent field from Duration', () => {
    // They are stored and reasoned about separately even though they share an
    // implementation; answering one must never imply the other.
    const both = setDailyEffortMinutes(
      setDurationDays(createOnboardingDraft(T0), 30, T1),
      20,
      T2,
    )

    expect(both.durationDays).toBe(30)
    expect(both.dailyEffortMinutes).toBe(20)

    const effortOnly = setDailyEffortMinutes(createOnboardingDraft(T0), 20, T1)
    expect('durationDays' in effortOnly).toBe(false)
  })
})

describe('milestones', () => {
  function empty(): OnboardingDraft {
    return createOnboardingDraft(T0)
  }

  function withOne(text = 'Run 5 km'): OnboardingDraft {
    const result = addMilestone(empty(), 'ms_first', text, T0)
    if (!result.ok) throw new Error(result.message)
    return result.draft
  }

  describe('addMilestone', () => {
    it('starts absent, so an unanswered question has one representation', () => {
      expect('milestones' in empty()).toBe(false)
      expect(milestoneCount(empty())).toBe(0)
      expect(hasAnsweredMilestones(empty())).toBe(false)
    })

    it('appends with the id the caller minted, in the order they were added', () => {
      const first = withOne('Run 5 km')
      const second = addMilestone(first, 'ms_second', 'Buy new shoes', T1)

      expect(second.ok).toBe(true)
      if (!second.ok) return

      expect(second.draft.milestones).toEqual([
        { id: 'ms_first', text: 'Run 5 km' },
        { id: 'ms_second', text: 'Buy new shoes' },
      ])
      expect(second.draft.updatedAt).toBe(T1)
      expect(hasAnsweredMilestones(second.draft)).toBe(true)
    })

    it('trims the outer whitespace of what is stored', () => {
      const result = addMilestone(empty(), 'ms_a', '   Run 5 km   ', T0)
      if (!result.ok) throw new Error(result.message)

      expect(result.draft.milestones?.[0]?.text).toBe('Run 5 km')
    })

    it('refuses a blank box and writes nothing', () => {
      const result = addMilestone(empty(), 'ms_a', '   ', T0)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('empty')
    })

    it('refuses a duplicate with a message rather than storing a second copy', () => {
      const result = addMilestone(withOne('Run 5 km'), 'ms_second', 'run 5km', T1)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('duplicate')
    })

    it('refuses a sixth milestone, and checks that BEFORE looking at the text', () => {
      // The order matters: "you already have five" is more useful than a
      // complaint about the sixth sentence, because the sixth could never be
      // added whatever it said.
      let draft = empty()
      for (let index = 0; index < MAX_MILESTONES; index += 1) {
        const result = addMilestone(draft, `ms_${index}`, `Milestone ${index}`, T0)
        if (!result.ok) throw new Error(result.message)
        draft = result.draft
      }

      const result = addMilestone(draft, 'ms_overflow', '', T1)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('too-many')
      expect(milestoneCount(draft)).toBe(MAX_MILESTONES)
    })

    it('does not mutate the draft it was given', () => {
      const before = withOne('Run 5 km')
      const snapshot = structuredClone(before)

      addMilestone(before, 'ms_second', 'Buy new shoes', T1)

      expect(before).toEqual(snapshot)
    })

    it('accepts emoji and other scripts without rewriting them', () => {
      const emoji = addMilestone(empty(), 'ms_a', '🎹 every day', T0)
      if (!emoji.ok) throw new Error(emoji.message)
      expect(emoji.draft.milestones?.[0]?.text).toBe('🎹 every day')

      const chinese = addMilestone(empty(), 'ms_b', '沉默。Flush。', T0)
      if (!chinese.ok) throw new Error(chinese.message)
      expect(chinese.draft.milestones?.[0]?.text).toBe('沉默。Flush。')
    })
  })

  describe('editMilestone', () => {
    it('changes the sentence and NOTHING else', () => {
      const before = withOne('Run 5 km')
      const result = editMilestone(before, 'ms_first', 'Run 10 km', T1)

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.draft.milestones).toEqual([{ id: 'ms_first', text: 'Run 10 km' }])
      expect(result.draft.updatedAt).toBe(T1)
    })

    it('keeps the id stable across a rename — the whole point of the operation', () => {
      const before = withOne('Run 5 km')
      const after = editMilestone(before, 'ms_first', 'Run a half marathon', T1)

      expect(after.ok).toBe(true)
      if (!after.ok) return

      expect(after.draft.milestones?.[0]?.id).toBe('ms_first')
      expect(after.draft.milestones?.[0]?.id).toBe(before.milestones?.[0]?.id)
    })

    it('saves an unchanged sentence without complaining about a duplicate', () => {
      // The bug this guards against: the milestone being edited is included in
      // its own duplicate check, so nothing can ever be saved.
      const before = withOne('Run 5 km')
      const result = editMilestone(before, 'ms_first', 'Run 5 km', T1)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.draft).toBe(before)
    })

    it('still refuses a sentence that duplicates a DIFFERENT milestone', () => {
      const two = addMilestone(withOne('Run 5 km'), 'ms_second', 'Buy new shoes', T1)
      if (!two.ok) throw new Error(two.message)

      const result = editMilestone(two.draft, 'ms_first', 'Buy new shoes', T2)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('duplicate')
    })

    it('refuses a blank box rather than deleting the milestone through an edit', () => {
      const before = withOne('Run 5 km')
      const result = editMilestone(before, 'ms_first', '   ', T1)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('empty')
    })

    it('refuses an unknown id instead of appending a second milestone', () => {
      const before = withOne('Run 5 km')
      const result = editMilestone(before, 'ms_nope', 'Something else', T1)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('not-found')
    })

    it('leaves the other milestones exactly where they were', () => {
      const two = addMilestone(withOne('Run 5 km'), 'ms_second', 'Buy new shoes', T1)
      if (!two.ok) throw new Error(two.message)

      const result = editMilestone(two.draft, 'ms_second', 'Book the race', T2)
      if (!result.ok) throw new Error(result.message)

      expect(result.draft.milestones).toEqual([
        { id: 'ms_first', text: 'Run 5 km' },
        { id: 'ms_second', text: 'Book the race' },
      ])
    })
  })

  describe('removeMilestone', () => {
    it('removes just the named one', () => {
      const two = addMilestone(withOne('Run 5 km'), 'ms_second', 'Buy new shoes', T1)
      if (!two.ok) throw new Error(two.message)

      const after = removeMilestone(two.draft, 'ms_first', T2)

      expect(after.milestones).toEqual([{ id: 'ms_second', text: 'Buy new shoes' }])
      expect(after.updatedAt).toBe(T2)
    })

    it('deletes the key when the last one goes, rather than leaving an empty list', () => {
      // `milestones: []` would claim the user answered this question with
      // nothing and would pass a step that exists to ask it.
      const after = removeMilestone(withOne(), 'ms_first', T1)

      expect('milestones' in after).toBe(false)
      expect(hasAnsweredMilestones(after)).toBe(false)
    })

    it('is a no-op returning the identical draft for an unknown id', () => {
      const before = withOne()

      expect(removeMilestone(before, 'ms_nope', T1)).toBe(before)
    })

    it('is a no-op returning the identical draft when there is no list at all', () => {
      const before = empty()

      expect(removeMilestone(before, 'ms_anything', T1)).toBe(before)
    })

    it('does not touch the Duration or Effort answers', () => {
      const answers = setDailyEffortMinutes(
        setDurationDays(withOne(), 30, T1),
        20,
        T1,
      )

      const after = removeMilestone(answers, 'ms_first', T2)

      expect(after.durationDays).toBe(30)
      expect(after.dailyEffortMinutes).toBe(20)
    })
  })
})

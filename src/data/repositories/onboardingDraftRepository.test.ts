import { describe, expect, it } from 'vitest'

import { migratedGrowthAreaId, suggestedGrowthAreaId } from '../../domain/growthAreaId'
import { recoveredMilestoneId } from '../../domain/milestone'
import {
  addCustomGrowthArea,
  addMilestone,
  createOnboardingDraft,
  selectGrowthArea,
  setDailyEffortMinutes,
  setDurationDays,
  setGoal,
  setWhy,
  ONBOARDING_SCHEMA_VERSION,
  type OnboardingDraft,
} from '../../domain/onboardingDraft'
import { createWebStorageStore } from '../storage'
import { ASCEND_ONBOARDING_DRAFT_KEY } from '../storage/keys'
import {
  classifyV2GrowthAreaId,
  createOnboardingDraftRepository,
  hasNewerSchema,
  migrateAndNormalizeDraft,
  migrateDraftV1ToV2,
  migrateDraftV2ToV3,
  migrateDraftV3ToV4,
  migrateDraftV4ToV5,
  ONBOARDING_DRAFT_MIGRATIONS,
} from './onboardingDraftRepository'

const NOW = '2026-10-01T09:00:00.000Z'
const LATER = '2026-10-01T09:05:00.000Z'

function sampleDraft() {
  let draft = createOnboardingDraft(NOW)
  draft = selectGrowthArea(draft, suggestedGrowthAreaId('fitness'), LATER)
  draft = addCustomGrowthArea(
    draft,
    { id: 'ga_c_pianofixed01', name: 'Piano', normalizedName: 'piano' },
    LATER,
  )
  return draft
}

/** A Phase 2A draft, exactly as it was written to storage. */
function phase2ADraft(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    currentStep: 'growth-areas',
    selectedGrowthAreas: ['fitness', 'piano'],
    customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
    startedAt: NOW,
    updatedAt: LATER,
    ...overrides,
  }
}

describe('migrateAndNormalizeDraft', () => {
  it('returns null when nothing is stored', () => {
    // Distinct from preferences, where "absent" and "corrupt" can share
    // a default. For a draft, null means "has never started".
    expect(migrateAndNormalizeDraft(null, NOW)).toBeNull()
    expect(migrateAndNormalizeDraft(undefined, NOW)).toBeNull()
  })

  it('returns null for a value that is not an object', () => {
    for (const raw of ['draft', 42, true, ['ga_fitness']]) {
      expect(migrateAndNormalizeDraft(raw, NOW)).toBeNull()
    }
  })

  it('keeps a valid current-version draft intact', () => {
    expect(migrateAndNormalizeDraft(sampleDraft(), NOW)).toEqual(sampleDraft())
  })

  it('discards a draft with no readable version, rather than guessing', () => {
    // A value with no schemaVersion is hand-written or from a build we
    // know nothing about. We cannot migrate it, so we start clean
    // rather than show answers we might have misread.
    expect(migrateAndNormalizeDraft({ selectedGrowthAreaIds: ['ga_fitness'] }, NOW)).toBeNull()
  })

  it('REFUSES a draft from a future version, rather than rewriting it as an older one', () => {
    // The rule that replaced "keep what you understand from a newer
    // version". That looked generous and was destructive: normalising
    // rebuilds the draft from the keys THIS build knows, so writing it back
    // DELETES the fields a newer build added. Refusing loses nothing —
    // nothing is written, and the newer build still reads the same bytes.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 99,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: [suggestedGrowthAreaId('fitness')],
        customGrowthAreas: [{ id: 'ga_c_x', name: 'Piano', normalizedName: 'piano' }],
        goal: { text: 'play a Chopin nocturne' },
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result).toBeNull()
  })

  it('drops a field it has no concept of, at its OWN version too', () => {
    // Adopting a shape we recognise is leniency; inventing one we do not is
    // how a draft acquires a field that nothing validates, nothing displays
    // and nothing can trust.
    //
    // This used to name `milestones`, which was a real future field and
    // therefore the honest example. Phase 2C made `milestones` a concept, so
    // the test now uses a field that is genuinely still beyond this build —
    // and the change is itself the point: a field stops being dropped on the
    // day a schema version is bumped to claim it, never before.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'goal',
        selectedGrowthAreaIds: [],
        customGrowthAreas: [],
        effortReminders: [{ at: '07:00', enabled: true }],
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('effortReminders')
  })

  it('drops a goal or why that is not text, rather than storing junk', () => {
    // Corruption, not an older format. Each of these would put something
    // in front of a textarea that expects a sentence.
    const junk = [42, true, {}, { text: 42 }, ['Run my first 10K'], { goal: 'x' }, null]

    for (const value of junk) {
      const result = migrateAndNormalizeDraft(
        {
          schemaVersion: ONBOARDING_SCHEMA_VERSION,
          currentStep: 'goal',
          selectedGrowthAreaIds: [],
          customGrowthAreas: [],
          goal: value,
          why: value,
          startedAt: NOW,
          updatedAt: LATER,
        },
        NOW,
      )

      expect(result, JSON.stringify(value)).not.toHaveProperty('goal')
      expect(result, JSON.stringify(value)).not.toHaveProperty('why')
    }
  })

  it('reads an empty stored answer as unanswered, not as an empty sentence', () => {
    // Reachable by hand-editing storage, and the one shape that has to be
    // refused rather than accepted: `{ text: '' }` would claim the user
    // answered with nothing.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'goal',
        selectedGrowthAreaIds: [],
        customGrowthAreas: [],
        goal: { text: '   ' },
        why: '',
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result).not.toHaveProperty('goal')
    expect(result).not.toHaveProperty('why')
  })

  it('adopts a bare-string answer, because the sentence is still the user’s', () => {
    // A bare string is not this build's shape, but rejecting it would throw
    // away a sentence a person typed over a formatting technicality.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'goal',
        selectedGrowthAreaIds: [],
        customGrowthAreas: [],
        why: '  so my daughter sees me finish  ',
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result?.why).toEqual({ text: 'so my daughter sees me finish' })
  })

  it('never writes an undefined goal or why key', () => {
    // The field must be ABSENT when unanswered, never present-and-empty.
    // `'goal' in draft` is the question the validators ask, so a key
    // carrying `undefined` would make every unanswered question look
    // answered while still reading as blank.
    const result = migrateAndNormalizeDraft(sampleDraft(), NOW)

    expect(result).not.toBeNull()
    expect('goal' in (result as object)).toBe(false)
    expect('why' in (result as object)).toBe(false)
    expect(Object.keys(result as object).some((key) => key === 'goal')).toBe(false)
  })

  it('runs registered migrations in order', () => {
    const migrations = {
      1: (value: unknown) => ({ ...(value as object), currentStep: 'goal' }),
    }

    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, currentStep: 'growth-areas' },
      NOW,
      2,
      migrations,
    )

    expect(result?.currentStep).toBe('goal')
  })

  it('discards a draft when a migration step is missing', () => {
    expect(
      migrateAndNormalizeDraft({ schemaVersion: 1, selectedGrowthAreaIds: ['ga_fitness'] }, NOW, 3, {}),
    ).toBeNull()
  })

  it('replaces an unrecognised step with welcome, keeping the selections', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        currentStep: 'levitation',
        selectedGrowthAreaIds: ['ga_fitness'],
      },
      NOW,
    )

    expect(result?.currentStep).toBe('welcome')
    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('drops selected ids that no longer name an area', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        selectedGrowthAreaIds: ['ga_fitness', 'ga_retiredina-later-build'],
      },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('drops duplicate selections but keeps the order the user chose in', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_reading', 'ga_fitness', 'ga_reading'] },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('reading'),
      suggestedGrowthAreaId('fitness'),
    ])
  })

  it('rejects non-string and empty selections', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_fitness', '', 42, null, ['x']] },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('discards unusable custom areas and keeps the good ones', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        customGrowthAreas: [
          { id: 'ga_c_keepme00000001', name: 'Piano', normalizedName: 'piano' },
          { id: 'ga_c_x', name: '   ' },
          { name: '' },
          'not-an-object',
          null,
          42,
        ],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: 'ga_c_keepme00000001', name: 'Piano', normalizedName: 'piano' },
    ])
  })

  it('TRUSTS a stored custom area id, and re-derives only the normalizedName', () => {
    // The inverse of the Phase 2A rule. An id is identity, so it is read;
    // a normalizedName is derived, so a tampered copy is overwritten.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        customGrowthAreas: [
          { id: 'ga_c_opaque00000001', name: ' Digital Marketing ', normalizedName: 'WRONG' },
        ],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: 'ga_c_opaque00000001', name: 'Digital Marketing', normalizedName: 'digital marketing' },
    ])
  })

  it('drops a custom area stored twice, keeping the user’s own spelling', () => {
    const sameId = 'ga_c_same000000001'
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        customGrowthAreas: [
          { id: sameId, name: 'Piano', normalizedName: 'piano' },
          { id: sameId, name: 'PIANO', normalizedName: 'piano' },
        ],
        selectedGrowthAreaIds: [sameId],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([{ id: sameId, name: 'Piano', normalizedName: 'piano' }])
    // And the selection still resolves, because the area survived.
    expect(result?.selectedGrowthAreaIds).toEqual([sameId])
  })

  it('keeps a draft whose timestamps are unreadable, because the answers are real', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_fitness'], startedAt: 'whenever', updatedAt: 5 },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
    expect(result?.startedAt).toBe(NOW)
    expect(result?.updatedAt).toBe(NOW)
  })

  it('survives a draft with no fields at all beyond the version', () => {
    expect(migrateAndNormalizeDraft({ schemaVersion: 2 }, NOW)).toEqual({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      currentStep: 'welcome',
      selectedGrowthAreaIds: [],
      customGrowthAreas: [],
      startedAt: NOW,
      updatedAt: NOW,
    })
  })
})

describe('the migration registry', () => {
  it('is keyed by the version each migration upgrades FROM, in order', () => {
    expect(Object.keys(ONBOARDING_DRAFT_MIGRATIONS)).toEqual(['1', '2', '3', '4'])
    expect(ONBOARDING_DRAFT_MIGRATIONS[1]).toBe(migrateDraftV1ToV2)
    expect(ONBOARDING_DRAFT_MIGRATIONS[2]).toBe(migrateDraftV2ToV3)
    expect(ONBOARDING_DRAFT_MIGRATIONS[3]).toBe(migrateDraftV3ToV4)
    expect(ONBOARDING_DRAFT_MIGRATIONS[4]).toBe(migrateDraftV4ToV5)
  })

  it('has a migration for every version below the current one', () => {
    // The gap that would silently discard a real user's answers: a draft at
    // version N with no N -> N+1 step is dropped rather than shown.
    const versions = Object.keys(ONBOARDING_DRAFT_MIGRATIONS).map(Number)

    for (let version = 1; version < ONBOARDING_SCHEMA_VERSION; version += 1) {
      expect(versions, `no migration from version ${version}`).toContain(version)
    }
  })
})

describe('v1 to v2 migration', () => {
  it('writes the shape v2 defined, not the shape v3 defines', () => {
    // A migration that emits a later version's format has no intermediate
    // state, which means v2 -> v3 has nothing real to be tested against. The
    // whole point of keeping the steps separate is lost.
    const migrated = migrateDraftV1ToV2(phase2ADraft()) as {
      selectedGrowthAreaIds: string[]
      customGrowthAreas: { id: string }[]
    }

    expect(migrated.selectedGrowthAreaIds[0]).toMatch(/^ga_[a-z]+$/)
    expect(migrated.customGrowthAreas[0]?.id).toMatch(/^ga_[0-9a-z]{14}$/)
    // Nothing in v2 carries a namespace prefix.
    for (const id of [...migrated.selectedGrowthAreaIds, migrated.customGrowthAreas[0]?.id ?? '']) {
      expect(id.startsWith('ga_s_') || id.startsWith('ga_c_') || id.startsWith('ga_m_')).toBe(false)
    }
  })

  it('keeps a real Phase 2A draft working', () => {
    // The user selected Fitness and a custom "Piano". After migration both
    // must still be selected, and the custom area must still be listed.
    const result = migrateAndNormalizeDraft(phase2ADraft(), NOW)

    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(result?.customGrowthAreas).toEqual([
      { id: migratedGrowthAreaId('piano'), name: 'Piano', normalizedName: 'piano' },
    ])
    expect(result?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('fitness'),
      migratedGrowthAreaId('piano'),
    ])
    expect(result?.currentStep).toBe('growth-areas')
    expect(result?.startedAt).toBe(NOW)
    expect(result?.updatedAt).toBe(LATER)
  })

  it('carries selections that were already normalized names', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({ selectedGrowthAreas: [' FITNESS ', 'Digital   Marketing'] }),
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('gives a migrated custom area a deterministic id', () => {
    // If this id were random, every page load would re-mint identities
    // and the user's selection would appear to vanish each time they
    // came back to the app.
    const first = migrateAndNormalizeDraft(phase2ADraft(), NOW)
    const second = migrateAndNormalizeDraft(phase2ADraft(), NOW)

    expect(first?.selectedGrowthAreaIds).toEqual(second?.selectedGrowthAreaIds)
    expect(first?.customGrowthAreas).toEqual(second?.customGrowthAreas)
  })

  it('does not reuse the Phase 2A name-as-id value', () => {
    // Keeping it would preserve the exact bug the migration exists to
    // fix: an identity that moves when the name is corrected.
    const result = migrateAndNormalizeDraft(phase2ADraft(), NOW)

    expect(result?.customGrowthAreas[0]?.id).not.toBe('piano')
  })

  it('migrates a draft with no custom areas at all', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({ customGrowthAreas: [], selectedGrowthAreas: ['reading', 'money'] }),
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([])
    expect(result?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('reading'),
      suggestedGrowthAreaId('money'),
    ])
  })

  it('keeps the first spelling when a custom area appears twice', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({
        customGrowthAreas: [
          { id: 'piano', name: 'Piano' },
          { id: 'piano', name: 'PIANO' },
        ],
        selectedGrowthAreas: ['piano'],
      }),
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: migratedGrowthAreaId('piano'), name: 'Piano', normalizedName: 'piano' },
    ])
  })

  it('never lets a migrated custom area shadow a suggestion', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({
        customGrowthAreas: [{ id: 'fitness', name: 'fitness' }],
        selectedGrowthAreas: ['fitness'],
      }),
      NOW,
    )

    // The selection resolves to the suggestion's id. In Phase 2A the two
    // entries shared one identity, so they were already the same area; the
    // migration must not turn that into a selection the screen cannot show.
    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])

    // The custom record is kept rather than deleted — it may be the only
    // remaining trace of what the user once wanted, and discarding data on
    // a guess is never the answer.
    expect(result?.customGrowthAreas).toEqual([
      { id: migratedGrowthAreaId('fitness'), name: 'fitness', normalizedName: 'fitness' },
    ])
  })

  it('drops a v1 selection with no area behind it, rather than inventing one', () => {
    // In Phase 2A such a name resolved to nothing, so the UI was already
    // showing it as unselected. Keeping it would mean claiming a choice
    // the screen cannot display.
    const result = migrateAndNormalizeDraft(
      phase2ADraft({ selectedGrowthAreas: ['fitness', 'nothingisbehindthename'] }),
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('discards unusable v1 custom areas', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({
        customGrowthAreas: [{ id: 'piano', name: 'Piano' }, null, 'nope', { id: 'x' }, { name: '  ' }],
      }),
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: migratedGrowthAreaId('piano'), name: 'Piano', normalizedName: 'piano' },
    ])
  })

  it('removes the superseded v1 field instead of leaving it behind', () => {
    // Two fields holding selections, one of them dead, is exactly the
    // kind of duplication that produces a bug six months later.
    const migrated = migrateDraftV1ToV2(phase2ADraft()) as Record<string, unknown>

    expect(migrated).not.toHaveProperty('selectedGrowthAreas')
    expect(migrated).toHaveProperty('selectedGrowthAreaIds')
  })

  it('preserves the order the user chose in', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({
        selectedGrowthAreas: ['money', 'fitness', 'reading'],
        customGrowthAreas: [],
      }),
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('money'),
      suggestedGrowthAreaId('fitness'),
      suggestedGrowthAreaId('reading'),
    ])
  })

  it('leaves values that are not objects alone', () => {
    for (const value of [null, 'draft', 42, ['x']]) {
      expect(migrateDraftV1ToV2(value)).toBe(value)
    }
  })

  it('preserves a v1 draft through a full save and load cycle', () => {
    // The end-to-end version of the same promise, through the real store
    // rather than through the pure function.
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(phase2ADraft()))

    const repository = createOnboardingDraftRepository(createWebStorageStore())
    const loaded = repository.load()

    expect(loaded?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(loaded?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('fitness'),
      migratedGrowthAreaId('piano'),
    ])

    // Saving and reloading must not re-mint the ids.
    expect(loaded).not.toBeNull()
    if (!loaded) return
    repository.save(loaded)
    expect(repository.load()).toEqual(loaded)
  })
})

describe('v2 to v3 migration', () => {
  /**
   * A v2 draft, exactly as the shipped v2 build wrote it: one `ga_` prefix for
   * every id, and origin carried only by suffix length.
   */
  function v2Draft(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 2,
      currentStep: 'growth-areas',
      selectedGrowthAreaIds: ['ga_fitness'],
      customGrowthAreas: [{ id: 'ga_0je9fby0j9v4i9', name: 'Piano', normalizedName: 'piano' }],
      startedAt: NOW,
      updatedAt: LATER,
      ...overrides,
    }
  }

  it('moves a suggested id into the suggested namespace', () => {
    const result = migrateDraftV2ToV3(v2Draft()) as { selectedGrowthAreaIds: string[] }

    expect(result.selectedGrowthAreaIds).toEqual(['ga_s_fitness'])
  })

  it('moves a 16-character random id into the custom namespace', () => {
    const result = migrateDraftV2ToV3(
      v2Draft({ customGrowthAreas: [{ id: 'ga_aa153c6817b8461c', name: 'Piano' }] }),
    ) as { customGrowthAreas: { id: string }[] }

    expect(result.customGrowthAreas[0]?.id).toBe('ga_c_aa153c6817b8461c')
  })

  it('moves a 14-character hashed id into the migrated namespace', () => {
    const result = migrateDraftV2ToV3(v2Draft()) as { customGrowthAreas: { id: string }[] }

    expect(result.customGrowthAreas[0]?.id).toBe('ga_m_0je9fby0j9v4i9')
  })

  it('keeps the suffix byte for byte, so identity survives the move', () => {
    // The requirement in one assertion: an id's meaning must not change just
    // because its namespace was made explicit. If the suffix were regenerated
    // rather than carried across, every stored reference would break.
    const migrated = migrateDraftV2ToV3(v2Draft()) as {
      selectedGrowthAreaIds: string[]
      customGrowthAreas: { id: string }[]
    }

    expect(migrated.selectedGrowthAreaIds[0]?.slice('ga_s_'.length)).toBe('fitness')
    expect(migrated.customGrowthAreas[0]?.id.slice('ga_m_'.length)).toBe('0je9fby0j9v4i9')
  })

  it('rewrites the same id identically wherever it appears', () => {
    // The selection and the area record must end up in agreement. If one were
    // migrated and the other not, the user would see their area listed and
    // unselected.
    const result = migrateAndNormalizeDraft(
      v2Draft({
        selectedGrowthAreaIds: ['ga_0je9fby0j9v4i9'],
        customGrowthAreas: [{ id: 'ga_0je9fby0j9v4i9', name: 'Piano', normalizedName: 'piano' }],
      }),
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_m_0je9fby0j9v4i9'])
    expect(result?.customGrowthAreas[0]?.id).toBe('ga_m_0je9fby0j9v4i9')
  })

  it('reads every suggested slug correctly, and never as a random suffix', () => {
    const slugs = ['fitness', 'learning', 'coding', 'business', 'communication']

    for (const slug of slugs) {
      const result = migrateDraftV2ToV3(
        v2Draft({ selectedGrowthAreaIds: [`ga_${slug}`], customGrowthAreas: [] }),
      ) as { selectedGrowthAreaIds: string[] }

      expect(result.selectedGrowthAreaIds, `slug ${slug}`).toEqual([`ga_s_${slug}`])
    }
  })

  it('prefers a slug over the length heuristic, however long the slug is', () => {
    // The reason the slug check runs first, proved against slugs the shipped
    // list happens not to contain. Today the longest is "communication" at
    // 13, so nothing in the real data exercises this — which is precisely why
    // it needed a test of its own. Getting the order wrong would move a
    // 14- or 16-character slug into a custom namespace, and every stored
    // reference to that suggestion would then point at an id that no longer
    // exists. A future release adding "self-development" would hit this.
    const fourteen = 'abcdefghijklmn'
    const sixteen = 'abcdefghijklmnop'

    expect(classifyV2GrowthAreaId(`ga_${fourteen}`, new Set([fourteen]))).toBe(
      `ga_s_${fourteen}`,
    )
    expect(classifyV2GrowthAreaId(`ga_${sixteen}`, new Set([sixteen]))).toBe(
      `ga_s_${sixteen}`,
    )
  })

  it('still classifies a long id as custom when no slug claims it', () => {
    // The mirror of the test above: the slug check must be a preference, not
    // a bypass. Without this, "check the slug list first" could be satisfied
    // by never checking lengths at all.
    const sixteen = 'aa153c6817b8461c'

    expect(classifyV2GrowthAreaId(`ga_${sixteen}`, new Set(['fitness']))).toBe(
      `ga_c_${sixteen}`,
    )
    expect(classifyV2GrowthAreaId('ga_0je9fby0j9v4i9', new Set(['fitness']))).toBe(
      'ga_m_0je9fby0j9v4i9',
    )
  })

  it('treats an unknown bare id of custom length as custom, which is the safe way round', () => {
    // A 16-character `ga_` id in v2 is indistinguishable from a random custom
    // id — that is precisely what v2 encoded origin as. So this case cannot be
    // resolved, and it is resolved the safe way: a custom id still resolves
    // and displays, whereas a wrongly-namespaced suggestion would not. The
    // alternative failure is cosmetic, so the ambiguity is acceptable.
    const result = migrateDraftV2ToV3(
      v2Draft({ selectedGrowthAreaIds: [`ga_${'a'.repeat(16)}`], customGrowthAreas: [] }),
    ) as { selectedGrowthAreaIds: string[] }

    expect(result.selectedGrowthAreaIds).toEqual([`ga_c_${'a'.repeat(16)}`])
  })

  it('leaves an id it cannot classify at all exactly as it is', () => {
    // Anything outside the alphabet or the expected lengths is left alone
    // rather than guessed at: a wrong guess produces a broken reference,
    // while an unchanged unknown is at worst still broken in the way it
    // already was.
    for (const id of ['ga_Retired-In-A-Later-Build', 'legacy_piano', 'ga_s_already_there', 'ga_']) {
      const result = migrateDraftV2ToV3(
        v2Draft({ selectedGrowthAreaIds: [id], customGrowthAreas: [] }),
      ) as { selectedGrowthAreaIds: string[] }

      expect(result.selectedGrowthAreaIds, `id ${id}`).toEqual([id])
    }
  })

  it('is idempotent, so a failed migration can simply be run again', () => {
    const once = migrateDraftV2ToV3(v2Draft())
    const twice = migrateDraftV2ToV3(once)

    expect(twice).toEqual(once)
  })

  it('never drops a custom area or a selection that still resolves', () => {
    // The whole reason migrations exist. Losing an area here would mean the
    // user's typing is gone with no trace and no way to recover it.
    const result = migrateAndNormalizeDraft(
      v2Draft({
        selectedGrowthAreaIds: ['ga_fitness', 'ga_0je9fby0j9v4i9', 'ga_aa153c6817b8461c'],
        customGrowthAreas: [
          { id: 'ga_0je9fby0j9v4i9', name: 'Piano', normalizedName: 'piano' },
          { id: 'ga_aa153c6817b8461c', name: 'Guitar', normalizedName: 'guitar' },
        ],
      }),
      NOW,
    )

    expect(result?.customGrowthAreas.map((area) => area.name)).toEqual(['Piano', 'Guitar'])
    expect(result?.selectedGrowthAreaIds).toEqual([
      'ga_s_fitness',
      'ga_m_0je9fby0j9v4i9',
      'ga_c_aa153c6817b8461c',
    ])
  })

  it('preserves the user’s own capitalisation of every name it carries through', () => {
    const result = migrateAndNormalizeDraft(
      v2Draft({
        customGrowthAreas: [{ id: 'ga_0je9fby0j9v4i9', name: '  PIANO  ', normalizedName: 'piano' }],
      }),
      NOW,
    )

    // Whitespace trimmed, capitalisation left alone: a name is the user's own
    // words, and rewriting them would be the app editing someone's voice.
    expect(result?.customGrowthAreas[0]?.name).toBe('PIANO')
  })

  it('preserves a v2 draft through a full save and load cycle', () => {
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(v2Draft()))

    const repository = createOnboardingDraftRepository(createWebStorageStore())
    const loaded = repository.load()

    expect(loaded?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(loaded?.selectedGrowthAreaIds).toEqual(['ga_s_fitness'])
    expect(loaded?.customGrowthAreas[0]?.id).toBe('ga_m_0je9fby0j9v4i9')

    expect(loaded).not.toBeNull()
    if (!loaded) return
    repository.save(loaded)

    // Reloading must not migrate again and must not change anything.
    expect(repository.load()).toEqual(loaded)
  })

  it('walks a v1 draft all the way to the current version without losing anything', () => {
    const result = migrateAndNormalizeDraft(phase2ADraft(), NOW)

    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(result?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('fitness'),
      migratedGrowthAreaId('piano'),
    ])
  })

  it('leaves values that are not objects alone', () => {
    for (const value of [null, 'draft', 42, ['x']]) {
      expect(migrateDraftV2ToV3(value)).toBe(value)
    }
  })
})

describe('v3 to v4 migration', () => {
  /** A v3 draft exactly as the 2A.1 build wrote it: no Goal, no WHY. */
  function v3Draft(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 3,
      currentStep: 'growth-areas',
      selectedGrowthAreaIds: ['ga_s_fitness'],
      customGrowthAreas: [{ id: 'ga_c_0123456789abcdef', name: 'Piano', normalizedName: 'piano' }],
      startedAt: NOW,
      updatedAt: LATER,
      ...overrides,
    }
  }

  it('carries an untouched v3 draft forward, still unanswered', () => {
    const result = migrateAndNormalizeDraft(v3Draft(), NOW)

    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_s_fitness'])
    expect(result).not.toHaveProperty('goal')
    expect(result).not.toHaveProperty('why')
  })

  it('keeps a Goal and a WHY that Phase 2B stored under the old v3 number', () => {
    // Phase 2B wrote these two fields for one commit before this number was
    // corrected, so real v3 drafts exist WITH them. The pass-through must
    // hand them to normalizeFields rather than treat them as unrecognised.
    const result = migrateAndNormalizeDraft(
      v3Draft({ goal: { text: 'Run my first 10K' }, why: { text: 'For my daughter' } }),
      NOW,
    )

    expect(result?.goal).toEqual({ text: 'Run my first 10K' })
    expect(result?.why).toEqual({ text: 'For my daughter' })
  })

  it('is a pure pass-through', () => {
    const stored = v3Draft()

    expect(migrateDraftV3ToV4(stored)).toBe(stored)
  })

  it('is registered, so a v3 draft is not mistaken for an unreconstructable one', () => {
    // The whole reason the pass-through exists: a missing step drops the
    // draft and sends the user back to the welcome screen, which would be
    // every existing user, all at once.
    expect(ONBOARDING_DRAFT_MIGRATIONS[3]).toBe(migrateDraftV3ToV4)
  })
})

describe('v4 to v5 migration', () => {
  /** A v4 draft exactly as the Phase 2B build wrote it: a Goal and a WHY, nothing more. */
  function v4Draft(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 4,
      currentStep: 'why',
      selectedGrowthAreaIds: ['ga_s_fitness'],
      customGrowthAreas: [],
      goal: { text: 'Run my first 10K' },
      why: { text: 'For my daughter' },
      startedAt: NOW,
      updatedAt: LATER,
      ...overrides,
    }
  }

  it('carries an untouched v4 draft forward, still unanswered on the new questions', () => {
    const result = migrateAndNormalizeDraft(v4Draft(), NOW)

    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(result?.goal).toEqual({ text: 'Run my first 10K' })
    expect(result?.why).toEqual({ text: 'For my daughter' })
    expect(result).not.toHaveProperty('durationDays')
    expect(result).not.toHaveProperty('milestones')
    expect(result).not.toHaveProperty('dailyEffortMinutes')
  })

  it('keeps Phase 2C fields that were stored under the old v4 number', () => {
    // The Phase 2C build wrote these three fields for one commit before this
    // number was corrected, so real v4 drafts exist WITH them. The
    // pass-through must hand them to normalizeFields rather than treat them
    // as unrecognised keys to delete.
    const result = migrateAndNormalizeDraft(
      v4Draft({
        durationDays: 30,
        milestones: [{ id: 'ms_keepme00000001', text: 'Run 5 km' }],
        dailyEffortMinutes: 20,
      }),
      NOW,
    )

    expect(result?.durationDays).toBe(30)
    expect(result?.dailyEffortMinutes).toBe(20)
    expect(result?.milestones).toEqual([{ id: 'ms_keepme00000001', text: 'Run 5 km' }])
  })

  it('is a pure pass-through', () => {
    const stored = v4Draft()

    expect(migrateDraftV4ToV5(stored)).toBe(stored)
  })

  it('is registered, so a v4 draft is not mistaken for an unreconstructable one', () => {
    // A missing entry at 4 would send every existing Phase 2B user back to the
    // welcome screen and lose their Goal and WHY outright.
    expect(ONBOARDING_DRAFT_MIGRATIONS[4]).toBe(migrateDraftV4ToV5)
  })

  it('runs the new step after every earlier one, in order', () => {
    const order: number[] = []
    const spy = (version: number) => (value: unknown) => {
      order.push(version)
      return value
    }

    migrateAndNormalizeDraft(
      { ...phase2ADraft() },
      NOW,
      ONBOARDING_SCHEMA_VERSION,
      { 1: spy(1), 2: spy(2), 3: spy(3), 4: spy(4) },
    )

    expect(order).toEqual([1, 2, 3, 4])
  })

  it('walks a real Phase 2B draft from v1 to v5 through the store without losing the answers', () => {
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify({
      ...phase2ADraft(),
      goal: { text: 'Run my first 10K' },
      why: { text: 'For my daughter' },
    }))

    const repository = createOnboardingDraftRepository(createWebStorageStore())
    const loaded = repository.load()

    expect(loaded?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(loaded?.goal).toEqual({ text: 'Run my first 10K' })
    expect(loaded?.why).toEqual({ text: 'For my daughter' })
    expect(loaded?.selectedGrowthAreaIds).toEqual([
      suggestedGrowthAreaId('fitness'),
      migratedGrowthAreaId('piano'),
    ])
    expect(loaded).not.toHaveProperty('durationDays')

    expect(loaded).not.toBeNull()
    if (!loaded) return
    repository.save(loaded)
    expect(repository.load()).toEqual(loaded)
  })
})

describe('the Duration, Milestones and Daily Effort fields', () => {
  /** A stored draft carrying all three Phase 2C answers, as bytes. */
  function storedPhase2CDraft() {
    let draft: OnboardingDraft = selectGrowthArea(createOnboardingDraft(NOW), suggestedGrowthAreaId('fitness'), NOW)
    draft = setGoal(draft, 'Run my first 10K', NOW)
    draft = setWhy(draft, 'For my daughter', NOW)
    draft = setDurationDays(draft, 30, NOW)

    const added = addMilestone(draft, 'ms_first000000001', 'Run 5 km', NOW)
    if (!added.ok) throw new Error(added.message)
    draft = added.draft

    return setDailyEffortMinutes(draft, 20, NOW)
  }

  it('reads all three back unchanged', () => {
    const stored = storedPhase2CDraft()
    const result = migrateAndNormalizeDraft(stored, NOW)

    expect(result).toEqual(stored)
  })

  it('never writes an undefined key for any of the three', () => {
    const result = migrateAndNormalizeDraft(createOnboardingDraft(NOW), NOW)

    expect(result).not.toBeNull()
    for (const key of ['durationDays', 'milestones', 'dailyEffortMinutes']) {
      expect(Object.keys(result as object), key).not.toContain(key)
    }
  })

  describe('durationDays and dailyEffortMinutes', () => {
    it('keeps a whole number even when it is outside this build’s bounds', () => {
      // Hand-edited storage, or a build with different bounds. Either way
      // somebody gave us this number, and the step validator refuses the step
      // rather than this layer throwing the answer away.
      const result = migrateAndNormalizeDraft(
        { ...createOnboardingDraft(NOW), durationDays: 500, dailyEffortMinutes: 1000 },
        NOW,
      )

      expect(result?.durationDays).toBe(500)
      expect(result?.dailyEffortMinutes).toBe(1000)
    })

    it('drops zero, negatives, fractions, strings and junk', () => {
      const junk = [0, -1, 30.5, NaN, Infinity, '30', true, {}, [], null, undefined]

      for (const value of junk) {
        const result = migrateAndNormalizeDraft(
          { ...createOnboardingDraft(NOW), durationDays: value, dailyEffortMinutes: value },
          NOW,
        )

        expect(result, JSON.stringify(value)).not.toBeNull()
        expect(result, JSON.stringify(value)).not.toHaveProperty('durationDays')
        expect(result, JSON.stringify(value)).not.toHaveProperty('dailyEffortMinutes')
      }
    })

    it('does not let one bad number discard the other good one', () => {
      const result = migrateAndNormalizeDraft(
        { ...createOnboardingDraft(NOW), durationDays: 0, dailyEffortMinutes: 20 },
        NOW,
      )

      expect(result).not.toHaveProperty('durationDays')
      expect(result?.dailyEffortMinutes).toBe(20)
    })
  })

  describe('milestones', () => {
    it('reads a well-formed list back in order', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [
            { id: 'ms_b', text: 'Buy new shoes' },
            { id: 'ms_a', text: 'Run 5 km' },
          ],
        },
        NOW,
      )

      expect(result?.milestones).toEqual([
        { id: 'ms_b', text: 'Buy new shoes' },
        { id: 'ms_a', text: 'Run 5 km' },
      ])
    })

    it('trims each stored sentence and keeps its wording and emoji', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [{ id: 'ms_a', text: '  Run 5 km 🏃  ' }],
        },
        NOW,
      )

      expect(result?.milestones?.[0]?.text).toBe('Run 5 km 🏃')
    })

    it('recovers a deterministic id when one is missing or blank', () => {
      const expected = recoveredMilestoneId('Run 5 km')
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [{ text: 'Run 5 km' }, { id: '   ', text: 'Buy new shoes' }],
        },
        NOW,
      )

      expect(result?.milestones?.[0]?.id).toBe(expected)
      expect(result?.milestones?.[1]?.id).toBe(recoveredMilestoneId('Buy new shoes'))
    })

    it('repairing the same draft twice gives the same ids, so nothing appears to vanish', () => {
      const raw = {
        ...createOnboardingDraft(NOW),
        milestones: [{ text: 'Run 5 km' }],
      }

      const first = migrateAndNormalizeDraft(raw, NOW)
      const second = migrateAndNormalizeDraft(raw, NOW)

      expect(first?.milestones).toEqual(second?.milestones)
    })

    it('turns a stored empty list into an ABSENT key, not an empty one', () => {
      const result = migrateAndNormalizeDraft(
        { ...createOnboardingDraft(NOW), milestones: [] },
        NOW,
      )

      expect(result).not.toHaveProperty('milestones')
    })

    it('turns a list where nothing was usable into an ABSENT key', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [null, 42, 'Run 5 km', {}, { text: '' }, { text: '   ' }],
        },
        NOW,
      )

      expect(result).not.toHaveProperty('milestones')
    })

    it('keeps the good entries and drops the unusable ones', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [
            null,
            { id: 'ms_a', text: 'Run 5 km' },
            42,
            { id: 'ms_b', text: 99 },
            { id: 'ms_c', text: 'Buy new shoes' },
          ],
        },
        NOW,
      )

      expect(result?.milestones).toEqual([
        { id: 'ms_a', text: 'Run 5 km' },
        { id: 'ms_c', text: 'Buy new shoes' },
      ])
    })

    it('drops a repeated id, keeping the first', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [
            { id: 'ms_same', text: 'Run 5 km' },
            { id: 'ms_same', text: 'Buy new shoes' },
          ],
        },
        NOW,
      )

      expect(result?.milestones).toEqual([{ id: 'ms_same', text: 'Run 5 km' }])
    })

    it('drops a repeated sentence, keeping the first spelling', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [
            { id: 'ms_a', text: 'Run 5 km' },
            { id: 'ms_b', text: '  run  5km!  ' },
          ],
        },
        NOW,
      )

      expect(result?.milestones).toEqual([{ id: 'ms_a', text: 'Run 5 km' }])
    })

    it('does NOT treat two different emoji as the same sentence', () => {
      const result = migrateAndNormalizeDraft(
        {
          ...createOnboardingDraft(NOW),
          milestones: [
            { id: 'ms_a', text: '🎹' },
            { id: 'ms_b', text: '🥁' },
          ],
        },
        NOW,
      )

      expect(result?.milestones).toHaveLength(2)
    })

    it('does NOT cap the count, because those are real sentences', () => {
      // Eight milestones cannot come from our screens, and truncating them
      // would silently delete work. The step validator refuses the step and
      // says to combine two; nothing is lost on disk until the user decides.
      const eight = Array.from({ length: 8 }, (_, index) => ({
        id: `ms_${index}`,
        text: `Milestone ${index}`,
      }))

      const result = migrateAndNormalizeDraft(
        { ...createOnboardingDraft(NOW), milestones: eight },
        NOW,
      )

      expect(result?.milestones).toHaveLength(8)
    })

    it('ignores a non-array value rather than storing the object', () => {
      for (const value of ['Run 5 km', 42, {}, true]) {
        const result = migrateAndNormalizeDraft(
          { ...createOnboardingDraft(NOW), milestones: value },
          NOW,
        )

        expect(result, JSON.stringify(value)).not.toHaveProperty('milestones')
      }
    })
  })
})

describe('an older build cannot silently overwrite the Phase 2C fields', () => {
  /**
   * The migrations a build whose current version is 4 would have registered.
   *
   * This is not a hypothetical: it is the exact code that was shipped, and it
   * still knows nothing about `durationDays`, `milestones` or
   * `dailyEffortMinutes`.
   */
  const A_BUILD_THAT_ONLY_KNOWS_V4 = {
    1: migrateDraftV1ToV2,
    2: migrateDraftV2ToV3,
    3: migrateDraftV3ToV4,
  }

  /** A v5 draft carrying all three Phase 2C answers, as it would sit on disk. */
  function storedV5() {
    let draft: OnboardingDraft = setGoal(createOnboardingDraft(NOW), 'Run my first 10K', NOW)
    draft = setDurationDays(draft, 30, NOW)

    const added = addMilestone(draft, 'ms_first000000001', 'Run 5 km', NOW)
    if (!added.ok) throw new Error(added.message)

    return setDailyEffortMinutes(added.draft, 20, NOW)
  }

  it('REFUSES the draft outright, because it declares a version the old build does not know', () => {
    // Refusing touches nothing. The old build shows a welcome screen, which
    // loses nothing at all — the newer build still reads the same bytes.
    const result = migrateAndNormalizeDraft(storedV5(), NOW, 4, A_BUILD_THAT_ONLY_KNOWS_V4)

    expect(result).toBeNull()
  })

  it('is necessary, because the reader that rebuilds from known keys drops what it cannot name', () => {
    // The literal counterfactual — these three fields written under version 4
    // and then read by the old build — cannot be run here: this build's
    // `normalizeFields` already knows all three keys, so it would keep them
    // whatever version number they arrived under. Re-implementing the old
    // reader in the test would prove nothing about the code that shipped.
    //
    // What CAN be run, and is the mechanism commit b3c8a91 turned into a bug,
    // is that a rebuild-from-known-keys reader drops a key it has no name for.
    // `effortReminders` stands in for such a key; the drop is real, silent,
    // and happens on the ordinary load-and-save path.
    const unBumped = {
      schemaVersion: 4,
      currentStep: 'why',
      selectedGrowthAreaIds: [],
      customGrowthAreas: [],
      goal: { text: 'Run my first 10K' },
      durationDays: 30,
      milestones: [{ id: 'ms_a', text: 'Run 5 km' }],
      dailyEffortMinutes: 20,
      effortReminders: [{ at: '20:00', enabled: true }],
      startedAt: NOW,
      updatedAt: LATER,
    }

    const result = migrateAndNormalizeDraft(unBumped, NOW, 4, A_BUILD_THAT_ONLY_KNOWS_V4)

    // The draft is accepted, because its declared version is one the old
    // build understands...
    expect(result).not.toBeNull()
    // ...and the key the old build has no name for is gone.
    expect(result).not.toHaveProperty('effortReminders')
    // The fields the old build DOES know survive, which is what made the
    // original bug so quiet: the draft looked perfectly fine afterwards.
    expect(result?.goal).toEqual({ text: 'Run my first 10K' })
  })

  it('still protects the bytes through a real save from the current build', () => {
    // The other half: this build writes v5, and a future v6 build refuses to
    // overwrite it. Checked here against a v6 draft carrying a v6-only field,
    // to prove the guard is about the version rather than about any one key.
    const future = JSON.stringify({
      schemaVersion: ONBOARDING_SCHEMA_VERSION + 1,
      currentStep: 'summary',
      selectedGrowthAreaIds: [],
      customGrowthAreas: [],
      durationDays: 30,
      milestones: [{ id: 'ms_a', text: 'Run 5 km' }],
      dailyEffortMinutes: 20,
      reflectionPrompts: [{ at: '20:00' }],
      startedAt: NOW,
      updatedAt: LATER,
    })

    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, future)

    const repository = createOnboardingDraftRepository(createWebStorageStore())

    expect(repository.load()).toBeNull()
    expect(repository.save(createOnboardingDraft(NOW))).toBe('newer-schema')
    // Byte for byte. Everything the newer build wrote is still there.
    expect(window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)).toBe(future)
  })
})

describe('onboardingDraftRepository', () => {
  it('saves and loads a draft through the store', () => {
    const repository = createOnboardingDraftRepository(createWebStorageStore())
    const draft = sampleDraft()

    repository.save(draft)

    expect(repository.load()).toEqual(draft)
  })

  it('returns null on first run', () => {
    expect(createOnboardingDraftRepository(createWebStorageStore()).load()).toBeNull()
  })

  it('survives a corrupt stored value', () => {
    // webStorageStore discards unparseable JSON and returns null, so the
    // repository sees "nothing here" and starts clean instead of
    // crashing the screen on every load.
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, '{ this is not json')

    expect(createOnboardingDraftRepository(createWebStorageStore()).load()).toBeNull()
  })

  it('does not let onboarding touch the preferences key', () => {
    const store = createWebStorageStore()
    const repository = createOnboardingDraftRepository(store)

    repository.save(sampleDraft())

    expect(window.localStorage.getItem('ascend:preferences:v1')).toBeNull()
    expect(window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)).not.toBeNull()
  })

  it('clears only the draft, leaving other stored data alone', () => {
    // Finishing onboarding must not disturb the user's theme. Separate
    // keys exist for exactly this reason.
    const store = createWebStorageStore()
    window.localStorage.setItem('ascend:preferences:v1', JSON.stringify({ schemaVersion: 1, theme: 'dark' }))
    const repository = createOnboardingDraftRepository(store)
    repository.save(sampleDraft())

    repository.clear()

    expect(repository.load()).toBeNull()
    expect(window.localStorage.getItem('ascend:preferences:v1')).not.toBeNull()
  })

  it('reports availability honestly', () => {
    // The onboarding screen shows a warning when progress cannot be
    // saved, so this must reflect the store instead of assuming success.
    expect(createOnboardingDraftRepository(createWebStorageStore(null)).isAvailable()).toBe(false)
  })

  it('reports a failed write instead of throwing', () => {
    const repository = createOnboardingDraftRepository(createWebStorageStore(null))

    expect(repository.save(sampleDraft())).toBe('unavailable')
  })
})

describe('refusing to overwrite a newer draft', () => {
  /** A draft from a build with one more schema version than this one. */
  function newerDraft() {
    return {
      schemaVersion: ONBOARDING_SCHEMA_VERSION + 1,
      currentStep: 'goal',
      selectedGrowthAreaIds: [],
      customGrowthAreas: [],
      goal: { text: 'an answer from a newer build' },
      why: { text: 'and the reason it matters' },
      startedAt: NOW,
      updatedAt: LATER,
    }
  }

  it('refuses to save over it, and leaves it byte for byte as it was', () => {
    // The half that makes refusing SAFE. `load()` returning null shows a
    // first-run screen, and without this guard the first tap would write a
    // fresh draft over the newer one — the loss refusing was meant to avoid,
    // just moved one step later.
    const raw = JSON.stringify(newerDraft())
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, raw)

    const repository = createOnboardingDraftRepository(createWebStorageStore())

    expect(repository.load()).toBeNull()
    expect(repository.save(createOnboardingDraft(NOW))).toBe('newer-schema')
    expect(window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)).toBe(raw)
  })

  it('saves normally when the stored draft is not newer', () => {
    const repository = createOnboardingDraftRepository(createWebStorageStore())

    expect(repository.save(createOnboardingDraft(NOW))).toBe('ok')
  })

  it('treats absent, corrupt and older values as nothing to protect', () => {
    // Refusing here would be a bug: there is no newer data to preserve.
    expect(hasNewerSchema(null)).toBe(false)
    expect(hasNewerSchema('not a draft')).toBe(false)
    expect(hasNewerSchema({ schemaVersion: 2 })).toBe(false)
    expect(hasNewerSchema({ schemaVersion: ONBOARDING_SCHEMA_VERSION })).toBe(false)
    expect(hasNewerSchema({ schemaVersion: ONBOARDING_SCHEMA_VERSION + 1 })).toBe(true)
  })
})

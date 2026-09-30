import { describe, expect, it } from 'vitest'

import { migratedGrowthAreaId } from '../../domain/growthAreaId'
import {
  addCustomGrowthArea,
  createOnboardingDraft,
  selectGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
} from '../../domain/onboardingDraft'
import { createWebStorageStore } from '../storage'
import { ASCEND_ONBOARDING_DRAFT_KEY } from '../storage/keys'
import {
  createOnboardingDraftRepository,
  migrateAndNormalizeDraft,
  migrateDraftV1ToV2,
  ONBOARDING_DRAFT_MIGRATIONS,
} from './onboardingDraftRepository'

const NOW = '2026-10-01T09:00:00.000Z'
const LATER = '2026-10-01T09:05:00.000Z'

function sampleDraft() {
  let draft = createOnboardingDraft(NOW)
  draft = selectGrowthArea(draft, 'ga_fitness', LATER)
  draft = addCustomGrowthArea(
    draft,
    { id: 'ga_pianofixed01', name: 'Piano', normalizedName: 'piano' },
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

  it('keeps what it understands from a future version', () => {
    // Newer data opened by an older build must not be thrown away: the
    // user really did answer those questions in a newer app.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 99,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: ['ga_fitness'],
        customGrowthAreas: [{ id: 'ga_x', name: 'Piano', normalizedName: 'piano' }],
        goal: 'play a Chopin nocturne',
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
    expect(result?.customGrowthAreas).toEqual([{ id: 'ga_x', name: 'Piano', normalizedName: 'piano' }])
    expect(result?.currentStep).toBe('growth-areas')
    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    // A field this build has no concept of is dropped, not smuggled in.
    expect(result).not.toHaveProperty('goal')
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
      { schemaVersion: 2, currentStep: 'levitation', selectedGrowthAreaIds: ['ga_fitness'] },
      NOW,
    )

    expect(result?.currentStep).toBe('welcome')
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
  })

  it('drops selected ids that no longer name an area', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        selectedGrowthAreaIds: ['ga_fitness', 'ga_retiredina-later-build'],
      },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
  })

  it('drops duplicate selections but keeps the order the user chose in', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_reading', 'ga_fitness', 'ga_reading'] },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_reading', 'ga_fitness'])
  })

  it('rejects non-string and empty selections', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_fitness', '', 42, null, ['x']] },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
  })

  it('discards unusable custom areas and keeps the good ones', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        customGrowthAreas: [
          { id: 'ga_keepme00001', name: 'Piano', normalizedName: 'piano' },
          { id: 'ga_x', name: '   ' },
          { name: '' },
          'not-an-object',
          null,
          42,
        ],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: 'ga_keepme00001', name: 'Piano', normalizedName: 'piano' },
    ])
  })

  it('TRUSTS a stored custom area id, and re-derives only the normalizedName', () => {
    // The inverse of the Phase 2A rule. An id is identity, so it is read;
    // a normalizedName is derived, so a tampered copy is overwritten.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        customGrowthAreas: [
          { id: 'ga_opaque0000001', name: ' Digital Marketing ', normalizedName: 'WRONG' },
        ],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: 'ga_opaque0000001', name: 'Digital Marketing', normalizedName: 'digital marketing' },
    ])
  })

  it('drops a custom area stored twice, keeping the user’s own spelling', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 2,
        customGrowthAreas: [
          { id: 'ga_same00000001', name: 'Piano', normalizedName: 'piano' },
          { id: 'ga_same00000001', name: 'PIANO', normalizedName: 'piano' },
        ],
        selectedGrowthAreaIds: ['ga_same00000001'],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([
      { id: 'ga_same00000001', name: 'Piano', normalizedName: 'piano' },
    ])
    // And the selection still resolves, because the area survived.
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_same00000001'])
  })

  it('keeps a draft whose timestamps are unreadable, because the answers are real', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 2, selectedGrowthAreaIds: ['ga_fitness'], startedAt: 'whenever', updatedAt: 5 },
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
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

describe('v1 to v2 migration', () => {
  it('is registered against the version it upgrades from', () => {
    expect(Object.keys(ONBOARDING_DRAFT_MIGRATIONS)).toEqual(['1'])
    expect(ONBOARDING_DRAFT_MIGRATIONS[1]).toBe(migrateDraftV1ToV2)
  })

  it('keeps a real Phase 2A draft working', () => {
    // The user selected Fitness and a custom "Piano". After migration both
    // must still be selected, and the custom area must still be listed.
    const result = migrateAndNormalizeDraft(phase2ADraft(), NOW)

    expect(result?.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION)
    expect(result?.customGrowthAreas).toEqual([
      { id: migratedGrowthAreaId('piano'), name: 'Piano', normalizedName: 'piano' },
    ])
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness', migratedGrowthAreaId('piano')])
    expect(result?.currentStep).toBe('growth-areas')
    expect(result?.startedAt).toBe(NOW)
    expect(result?.updatedAt).toBe(LATER)
  })

  it('carries selections that were already normalized names', () => {
    const result = migrateAndNormalizeDraft(
      phase2ADraft({ selectedGrowthAreas: [' FITNESS ', 'Digital   Marketing'] }),
      NOW,
    )

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
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
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_reading', 'ga_money'])
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
    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])

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

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_fitness'])
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

    expect(result?.selectedGrowthAreaIds).toEqual(['ga_money', 'ga_fitness', 'ga_reading'])
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
    expect(loaded?.selectedGrowthAreaIds).toEqual(['ga_fitness', migratedGrowthAreaId('piano')])

    // Saving and reloading must not re-mint the ids.
    expect(loaded).not.toBeNull()
    if (!loaded) return
    repository.save(loaded)
    expect(repository.load()).toEqual(loaded)
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

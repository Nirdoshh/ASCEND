import { describe, expect, it } from 'vitest'

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
} from './onboardingDraftRepository'

const NOW = '2026-10-01T09:00:00.000Z'
const LATER = '2026-10-01T09:05:00.000Z'

function sampleDraft() {
  let draft = createOnboardingDraft(NOW)
  draft = selectGrowthArea(draft, 'fitness', LATER)
  draft = addCustomGrowthArea(draft, { id: 'piano', name: 'Piano' }, LATER)
  return draft
}

describe('migrateAndNormalizeDraft', () => {
  it('returns null when nothing is stored', () => {
    // Distinct from preferences, where "absent" and "corrupt" can share
    // a default. For a draft, null means "has never started".
    expect(migrateAndNormalizeDraft(null, NOW)).toBeNull()
    expect(migrateAndNormalizeDraft(undefined, NOW)).toBeNull()
  })

  it('returns null for a value that is not an object', () => {
    for (const raw of ['draft', 42, true, ['fitness']]) {
      expect(migrateAndNormalizeDraft(raw, NOW)).toBeNull()
    }
  })

  it('keeps a valid draft intact', () => {
    const draft = migrateAndNormalizeDraft(sampleDraft(), NOW)

    expect(draft).toEqual(sampleDraft())
  })

  it('discards a draft with no readable version, rather than guessing', () => {
    // A value with no schemaVersion is hand-written or from a build we
    // know nothing about. We cannot migrate it, so we start clean
    // rather than show answers we might have misread.
    expect(migrateAndNormalizeDraft({ selectedGrowthAreas: ['fitness'] }, NOW)).toBeNull()
  })

  it('keeps what it understands from a future version', () => {
    // v2 data opened by a v1 build must not be thrown away: the user
    // really did answer those questions in a newer app.
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 99,
        currentStep: 'growth-areas',
        selectedGrowthAreas: ['fitness'],
        customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
        goal: 'play a Chopin nocturne',
        startedAt: NOW,
        updatedAt: LATER,
      },
      NOW,
    )

    expect(result?.selectedGrowthAreas).toEqual(['fitness'])
    expect(result?.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
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
      migrateAndNormalizeDraft({ schemaVersion: 1, selectedGrowthAreas: ['fitness'] }, NOW, 3, {}),
    ).toBeNull()
  })

  it('replaces an unrecognised step with welcome, keeping the selections', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, currentStep: 'levitation', selectedGrowthAreas: ['fitness'] },
      NOW,
    )

    expect(result?.currentStep).toBe('welcome')
    expect(result?.selectedGrowthAreas).toEqual(['fitness'])
  })

  it('drops selected ids that no longer name an area', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 1,
        selectedGrowthAreas: ['fitness', 'retired-in-a-later-build'],
      },
      NOW,
    )

    expect(result?.selectedGrowthAreas).toEqual(['fitness'])
  })

  it('drops duplicate selections but keeps the order the user chose in', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, selectedGrowthAreas: ['reading', 'fitness', 'reading'] },
      NOW,
    )

    expect(result?.selectedGrowthAreas).toEqual(['reading', 'fitness'])
  })

  it('rejects non-string and empty selections', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, selectedGrowthAreas: ['fitness', '', 42, null, ['x']] },
      NOW,
    )

    expect(result?.selectedGrowthAreas).toEqual(['fitness'])
  })

  it('discards unusable custom areas and keeps the good ones', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 1,
        customGrowthAreas: [
          { id: 'piano', name: 'Piano' },
          { id: 'x', name: '   ' },
          { name: '' },
          'not-an-object',
          null,
          42,
        ],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
  })

  it('re-derives a custom area id instead of trusting the stored one', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, customGrowthAreas: [{ id: 'tampered', name: ' Digital Marketing ' }] },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([{ id: 'digital marketing', name: 'Digital Marketing' }])
  })

  it('drops a custom area stored twice, keeping the user’s own spelling', () => {
    const result = migrateAndNormalizeDraft(
      {
        schemaVersion: 1,
        customGrowthAreas: [
          { name: 'Piano' },
          { name: 'PIANO' },
        ],
        selectedGrowthAreas: ['piano'],
      },
      NOW,
    )

    expect(result?.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
    // And the selection now resolves, because the area survived.
    expect(result?.selectedGrowthAreas).toEqual(['piano'])
  })

  it('keeps a draft whose timestamps are unreadable, because the answers are real', () => {
    const result = migrateAndNormalizeDraft(
      { schemaVersion: 1, selectedGrowthAreas: ['fitness'], startedAt: 'whenever', updatedAt: 5 },
      NOW,
    )

    expect(result?.selectedGrowthAreas).toEqual(['fitness'])
    expect(result?.startedAt).toBe(NOW)
    expect(result?.updatedAt).toBe(NOW)
  })

  it('survives a draft with no fields at all beyond the version', () => {
    const result = migrateAndNormalizeDraft({ schemaVersion: 1 }, NOW)

    expect(result).toEqual({
      schemaVersion: 1,
      currentStep: 'welcome',
      selectedGrowthAreas: [],
      customGrowthAreas: [],
      startedAt: NOW,
      updatedAt: NOW,
    })
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

    const repository = createOnboardingDraftRepository(createWebStorageStore())

    expect(repository.load()).toBeNull()
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
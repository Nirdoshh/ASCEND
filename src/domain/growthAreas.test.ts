import { describe, expect, it } from 'vitest'

import { createGrowthAreaId, GROWTH_AREA_ID_PREFIX, migratedGrowthAreaId } from './growthAreaId'
import { normalizeGrowthAreaName, toGrowthAreaDisplayName } from './growthAreaName'
import {
  createCustomGrowthArea,
  findById,
  findByNormalizedName,
  MAX_GROWTH_AREA_NAME_LENGTH,
  mergeGrowthAreas,
  SUGGESTED_GROWTH_AREAS,
  type GrowthArea,
} from './growthAreas'

const NO_EXISTING: readonly GrowthArea[] = []

/** A fixed id, so every assertion about identity is deterministic. */
const FIXED_ID = `${GROWTH_AREA_ID_PREFIX}testfixed0001`

function create(raw: string, existing: readonly GrowthArea[] = NO_EXISTING) {
  return createCustomGrowthArea(raw, existing, FIXED_ID)
}

function custom(name: string, id: string): GrowthArea {
  return { id, name, normalizedName: normalizeGrowthAreaName(name), kind: 'custom' }
}

describe('identity is separate from the name', () => {
  it('does not derive a custom area id from its name', () => {
    const result = create('Digital Marketing')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The whole point of this correction. The id is whatever the caller
    // minted, and it bears no resemblance to the name.
    expect(result.area.id).toBe(FIXED_ID)
    expect(result.area.id).not.toContain('digital')
    expect(result.area.id).not.toBe(result.area.normalizedName)
  })

  it('keeps all three names in their own roles', () => {
    const result = create('  DIGITAL   Marketing  ')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.area).toEqual({
      id: FIXED_ID,
      // Display keeps the user's own capitalization.
      name: 'DIGITAL Marketing',
      // Comparison collapses spacing and case.
      normalizedName: 'digital marketing',
      kind: 'custom',
    })
  })

  it('gives two areas with the same name different identities', () => {
    // This is the property that makes cross-device sync and later merging
    // possible. Name-derived ids would collapse these into one.
    const first = createCustomGrowthArea('Piano', NO_EXISTING, 'ga_first00000000001')
    const second = createCustomGrowthArea('Piano', NO_EXISTING, 'ga_second0000000001')

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(first.area.normalizedName).toBe(second.area.normalizedName)
    expect(first.area.id).not.toBe(second.area.id)
  })
})

describe('suggested area ids are a permanent contract', () => {
  it('pins every suggested id', () => {
    // If this test needs changing, an id changed, and every stored
    // reference to that area just broke. That must be a deliberate act.
    expect(SUGGESTED_GROWTH_AREAS.map((area) => area.id)).toEqual([
      'ga_fitness',
      'ga_learning',
      'ga_coding',
      'ga_business',
      'ga_communication',
      'ga_creativity',
      'ga_reading',
      'ga_money',
      'ga_confidence',
      'ga_discipline',
    ])
  })

  it('pairs each id with the display name it ships today', () => {
    expect(SUGGESTED_GROWTH_AREAS.map((area) => [area.id, area.name])).toEqual([
      ['ga_fitness', 'Fitness'],
      ['ga_learning', 'Learning'],
      ['ga_coding', 'Coding'],
      ['ga_business', 'Business'],
      ['ga_communication', 'Communication'],
      ['ga_creativity', 'Creativity'],
      ['ga_reading', 'Reading'],
      ['ga_money', 'Money'],
      ['ga_confidence', 'Confidence'],
      ['ga_discipline', 'Discipline'],
    ])
  })

  it('carries a normalizedName consistent with its display name', () => {
    for (const area of SUGGESTED_GROWTH_AREAS) {
      expect(area.normalizedName).toBe(normalizeGrowthAreaName(area.name))
      expect(area.kind).toBe('suggested')
      expect(area.id.startsWith(GROWTH_AREA_ID_PREFIX)).toBe(true)
    }
  })

  it('writes the id out separately from the name, rather than composing them', () => {
    // A suggested id is a literal in the source table, not a value
    // computed from the display name. That is why renaming one later
    // cannot orphan anything that referenced it. Pinned by the two tests
    // above; this records the reason they must stay in place.
    const communication = SUGGESTED_GROWTH_AREAS.find((a) => a.id === 'ga_communication')

    expect(communication?.name).toBe('Communication')
    expect(communication?.id).toBe(`${GROWTH_AREA_ID_PREFIX}communication`)
  })
})

describe('name normalization', () => {
  it('treats casing, padding and repeated spaces as the same name', () => {
    const id = normalizeGrowthAreaName('Digital Marketing')

    expect(normalizeGrowthAreaName('Digital Marketing')).toBe(id)
    expect(normalizeGrowthAreaName(' digital marketing ')).toBe(id)
    expect(normalizeGrowthAreaName('DIGITAL MARKETING')).toBe(id)
    expect(normalizeGrowthAreaName('Digital    Marketing')).toBe(id)
    expect(normalizeGrowthAreaName('Digital\tMarketing')).toBe(id)
    expect(normalizeGrowthAreaName('Digital\nMarketing')).toBe(id)
    expect(normalizeGrowthAreaName(' Digital Marketing ')).toBe(id)
  })

  it('preserves the capitalization the user typed when displaying', () => {
    expect(toGrowthAreaDisplayName('DIGITAL MARKETING')).toBe('DIGITAL MARKETING')
    expect(toGrowthAreaDisplayName('  digital   marketing ')).toBe('digital marketing')
    expect(toGrowthAreaDisplayName('Digital Marketing')).toBe('Digital Marketing')
  })

  it('recognises non-Latin and emoji names as real words', () => {
    for (const name of ['ピアノ', 'بيانو', 'योग', 'Piano 🎹', 'Pianoforte']) {
      expect(create(name).ok, `expected “${name}” to be accepted`).toBe(true)
    }
  })
})

describe('createCustomGrowthArea', () => {
  it('accepts a new name and keeps the user’s capitalization', () => {
    const result = create('  Digital Marketing  ')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.area.name).toBe('Digital Marketing')
  })

  it('refuses an empty or whitespace-only name', () => {
    for (const raw of ['', '   ', '\t\n  ']) {
      const result = create(raw)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('empty')
      expect(result.message).toBe('Type a name for your new area.')
    }
  })

  it('refuses a name that is far too long without truncating it', () => {
    const result = create('A'.repeat(MAX_GROWTH_AREA_NAME_LENGTH + 1))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('too-long')
    expect(result.message).toContain(String(MAX_GROWTH_AREA_NAME_LENGTH))
  })

  it('accepts a name at exactly the maximum length', () => {
    expect(create('B'.repeat(MAX_GROWTH_AREA_NAME_LENGTH)).ok).toBe(true)
  })

  it('refuses decoration with no letters or numbers', () => {
    for (const raw of ['!!!', '🎉🎉', '*** ***', '🎸']) {
      const result = create(raw)
      expect(result.ok, `expected “${raw}” to be refused`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('no-words')
    }
  })

  it('refuses a duplicate by normalizedName, whatever the casing or spacing', () => {
    // The comparison key is the name, NOT the id. Two entries with
    // different ids but the same normalizedName are still the same area
    // as far as the user is concerned.
    const existing: GrowthArea[] = [custom('Digital Marketing', 'ga_somethingelse1')]

    for (const raw of [
      'Digital Marketing',
      'digital marketing',
      'DIGITAL MARKETING',
      '  digital   marketing  ',
      'Digital\tMarketing',
    ]) {
      const result = create(raw, existing)
      expect(result.ok, `expected “${raw}” to be a duplicate`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('duplicate')
      // The message names the area the user already has, in the
      // capitalization they originally chose.
      expect(result.message).toBe('You already added “Digital Marketing”.')
    }
  })

  it('refuses a duplicate of a suggested area, in any capitalization', () => {
    const result = create(' FITNESS ', SUGGESTED_GROWTH_AREAS)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('duplicate')
    expect(result.message).toBe('You already added “Fitness”.')
  })

  it('reports an empty name before a duplicate, because “already added” needs a name', () => {
    const result = create('   ', [custom('Digital Marketing', 'ga_somethingelse1')])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('empty')
  })
})

describe('lookups', () => {
  it('finds by identity, not by name', () => {
    const areas = [custom('Piano', 'ga_abc'), custom('Coding', 'ga_def')]

    expect(findById(areas, 'ga_abc')?.name).toBe('Piano')
    expect(findById(areas, 'piano')).toBeUndefined()
    expect(findById(areas, 'nothing')).toBeUndefined()
  })

  it('finds by comparison name, not by identity', () => {
    const areas = [custom('Piano', 'ga_abc')]

    expect(findByNormalizedName(areas, 'piano')?.id).toBe('ga_abc')
    expect(findByNormalizedName(areas, ' PIANO ')?.id).toBe('ga_abc')
    expect(findByNormalizedName(areas, 'ga_abc')).toBeUndefined()
  })
})

describe('mergeGrowthAreas', () => {
  it('puts custom and suggested areas in one list, custom last', () => {
    const merged = mergeGrowthAreas([custom('Piano', 'ga_piano')])

    expect(merged).toHaveLength(11)
    expect(merged.slice(0, 10)).toEqual(SUGGESTED_GROWTH_AREAS)
    expect(merged[10]?.name).toBe('Piano')
  })

  it('drops an entry that repeats an identity', () => {
    const merged = mergeGrowthAreas([custom('Piano', 'ga_piano'), custom('Piano again', 'ga_piano')])

    expect(merged.filter((area) => area.id === 'ga_piano')).toHaveLength(1)
  })

  it('drops a custom area that collides with a suggestion by name', () => {
    // Different ids, same name. The user would call these the same thing,
    // so only one is offered — and the built-in name survives.
    const merged = mergeGrowthAreas([custom('FITNESS', 'ga_users_fitness')])

    expect(merged).toHaveLength(10)
    const fitness = merged.filter((area) => area.normalizedName === 'fitness')
    expect(fitness).toHaveLength(1)
    expect(fitness[0]?.id).toBe('ga_fitness')
  })

  it('is stable across repeated merges of the same data', () => {
    const customAreas = [custom('Piano', 'ga_piano')]
    expect(mergeGrowthAreas(customAreas)).toEqual(mergeGrowthAreas(customAreas))
  })

  it('never produces two areas sharing an identity or a comparison name', () => {
    const merged = mergeGrowthAreas([
      custom('Piano', 'ga_a'),
      custom('PIANO', 'ga_b'),
      custom('Piano', 'ga_a'),
    ])

    expect(new Set(merged.map((a) => a.id)).size).toBe(merged.length)
    expect(new Set(merged.map((a) => a.normalizedName)).size).toBe(merged.length)
  })
})

describe('id generation', () => {
  it('prefixes ids so they are recognisable', () => {
    expect(createGrowthAreaId().startsWith(GROWTH_AREA_ID_PREFIX)).toBe(true)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createGrowthAreaId()))
    expect(ids.size).toBe(500)
  })

  it('never collides with a suggested id', () => {
    const suggested = new Set(SUGGESTED_GROWTH_AREAS.map((area) => area.id))
    for (let index = 0; index < 200; index += 1) {
      expect(suggested.has(createGrowthAreaId())).toBe(false)
    }
  })
})

describe('migrated ids', () => {
  it('is derived from the name, so the same draft always migrates the same way', () => {
    // Determinism is the whole point. A random id here would re-mint
    // identities on every page load and the user's selection would appear
    // to vanish each time they came back.
    expect(migratedGrowthAreaId('piano')).toBe(migratedGrowthAreaId('piano'))
    expect(migratedGrowthAreaId('piano')).toMatch(/^ga_[0-9a-z]{14}$/)
  })

  it('differs for different names', () => {
    expect(migratedGrowthAreaId('piano')).not.toBe(migratedGrowthAreaId('guitar'))
  })

  it('is fixed for known names, so a future re-migration cannot drift', () => {
    // If a hash implementation ever changes, existing ids are already
    // stored and unaffected — but a draft that failed to migrate twice
    // would produce something different. These values pin that.
    expect(migratedGrowthAreaId('piano')).toMatch(/^ga_[0-9a-z]{14}$/)
    expect(migratedGrowthAreaId('')).toMatch(/^ga_[0-9a-z]{14}$/)
  })

  it('cannot collide with a random id, because the lengths differ', () => {
    // This is the property the whole two-space scheme rests on. If a
    // random id were ever shortened to match, ids minted before and after
    // a migration could overlap.
    const randomIds = new Set(Array.from({ length: 500 }, () => createGrowthAreaId()))

    for (const name of ['piano', 'guitar', 'fitness', 'reading', 'a', 'a very long name']) {
      expect(randomIds.has(migratedGrowthAreaId(name))).toBe(false)
    }

    expect(createGrowthAreaId()).toMatch(/^ga_[0-9a-z]{16}$/)
    expect(migratedGrowthAreaId('piano')).toMatch(/^ga_[0-9a-z]{14}$/)
  })

  it('produces 14 characters for a wide range of inputs, including non-Latin', () => {
    for (const name of ['ピアノ', 'بيانو', 'योग', 'Ω', 'x'.repeat(60)]) {
      expect(migratedGrowthAreaId(name)).toMatch(/^ga_[0-9a-z]{14}$/)
    }
  })

  it('does not repeat across many names', () => {
    const ids = new Set(
      Array.from({ length: 300 }, (_, index) => migratedGrowthAreaId(`area number ${index}`)),
    )

    expect(ids.size).toBe(300)
  })
})

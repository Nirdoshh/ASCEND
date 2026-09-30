import { describe, expect, it } from 'vitest'

import {
  createCustomGrowthArea,
  findById,
  MAX_GROWTH_AREA_NAME_LENGTH,
  mergeGrowthAreas,
  normalizeGrowthAreaName,
  SUGGESTED_GROWTH_AREAS,
  toGrowthAreaDisplayName,
  type GrowthArea,
} from './growthAreas'

const NO_EXISTING: readonly GrowthArea[] = []

describe('growth area names', () => {
  it('treats casing, padding and repeated spaces as the same name', () => {
    const id = normalizeGrowthAreaName('Digital Marketing')

    expect(normalizeGrowthAreaName('Digital Marketing')).toBe(id)
    expect(normalizeGrowthAreaName(' digital marketing ')).toBe(id)
    expect(normalizeGrowthAreaName('DIGITAL MARKETING')).toBe(id)
    expect(normalizeGrowthAreaName('Digital    Marketing')).toBe(id)
    expect(normalizeGrowthAreaName('Digital\tMarketing')).toBe(id)
    expect(normalizeGrowthAreaName('Digital\nMarketing')).toBe(id)
    expect(normalizeGrowthAreaName(' Digital Marketing ')).toBe(id)
  })

  it('preserves the capitalization the user typed when displaying', () => {
    expect(toGrowthAreaDisplayName('DIGITAL MARKETING')).toBe('DIGITAL MARKETING')
    expect(toGrowthAreaDisplayName('  digital   marketing ')).toBe('digital marketing')
    expect(toGrowthAreaDisplayName('Digital Marketing')).toBe('Digital Marketing')
  })

  it('recognises non-Latin and emoji names as real words', () => {
    // These must not be rejected as "symbols with no letters".
    for (const name of ['ピアノ', 'بيانو', 'योग', 'Piano 🎹', 'Pianoforte']) {
      const result = createCustomGrowthArea(name, NO_EXISTING)
      expect(result.ok, `expected “${name}” to be accepted`).toBe(true)
    }
  })
})

describe('createCustomGrowthArea', () => {
  it('accepts a new name and keeps the user’s capitalization', () => {
    const result = createCustomGrowthArea('  Digital Marketing  ', NO_EXISTING)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.area).toEqual({
      id: 'digital marketing',
      name: 'Digital Marketing',
      kind: 'custom',
    })
  })

  it('refuses an empty or whitespace-only name', () => {
    for (const raw of ['', '   ', '\t\n  ']) {
      const result = createCustomGrowthArea(raw, NO_EXISTING)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('empty')
      expect(result.message).toBe('Type a name for your new area.')
    }
  })

  it('refuses a name that is far too long without truncating it', () => {
    const long = 'A'.repeat(MAX_GROWTH_AREA_NAME_LENGTH + 1)
    const result = createCustomGrowthArea(long, NO_EXISTING)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('too-long')
    expect(result.message).toContain(String(MAX_GROWTH_AREA_NAME_LENGTH))
  })

  it('accepts a name at exactly the maximum length', () => {
    const exact = 'B'.repeat(MAX_GROWTH_AREA_NAME_LENGTH)
    expect(createCustomGrowthArea(exact, NO_EXISTING).ok).toBe(true)
  })

  it('refuses decoration with no letters or numbers', () => {
    for (const raw of ['!!!', '🎉🎉', '*** ***', '🎸']) {
      const result = createCustomGrowthArea(raw, NO_EXISTING)
      expect(result.ok, `expected “${raw}” to be refused`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('no-words')
    }
  })

  it('refuses a duplicate regardless of case or spacing', () => {
    const existing: GrowthArea[] = [{ id: 'digital marketing', name: 'Digital Marketing', kind: 'custom' }]

    for (const raw of ['Digital Marketing', 'digital marketing', 'DIGITAL MARKETING', '  digital   marketing  ']) {
      const result = createCustomGrowthArea(raw, existing)
      expect(result.ok, `expected “${raw}” to be a duplicate`).toBe(false)
      if (result.ok) return
      expect(result.problem).toBe('duplicate')
      // The message names the area the user already has, in the
      // capitalization they originally chose.
      expect(result.message).toBe('You already added “Digital Marketing”.')
    }
  })

  it('refuses a duplicate of a suggested area, in any capitalization', () => {
    const result = createCustomGrowthArea(' FITNESS ', SUGGESTED_GROWTH_AREAS)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('duplicate')
    expect(result.message).toBe('You already added “Fitness”.')
  })

  it('reports an empty name before a duplicate, because "already added" needs a name', () => {
    const existing: GrowthArea[] = [{ id: 'digital marketing', name: 'Digital Marketing', kind: 'custom' }]
    const result = createCustomGrowthArea('   ', existing)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problem).toBe('empty')
  })
})

describe('suggested areas', () => {
  it('provides the ten starting suggestions, each with a normalized id', () => {
    expect(SUGGESTED_GROWTH_AREAS).toHaveLength(10)

    for (const area of SUGGESTED_GROWTH_AREAS) {
      expect(area.kind).toBe('suggested')
      expect(area.id).toBe(normalizeGrowthAreaName(area.name))
      expect(area.id).not.toBe('')
    }
  })
})

describe('mergeGrowthAreas', () => {
  it('puts custom and suggested areas in one list, custom last', () => {
    const custom: GrowthArea[] = [{ id: 'piano', name: 'Piano', kind: 'custom' }]

    const merged = mergeGrowthAreas(custom)

    expect(merged).toHaveLength(11)
    expect(merged.slice(0, 10)).toEqual(SUGGESTED_GROWTH_AREAS)
    expect(merged[10]).toEqual(custom[0])
  })

  it('keeps only one entry when a custom area collides with a suggestion', () => {
    const custom: GrowthArea[] = [{ id: 'fitness', name: 'FITNESS', kind: 'custom' }]
    const merged = mergeGrowthAreas(custom)

    const fitness = merged.filter((area) => area.id === 'fitness')
    expect(fitness).toHaveLength(1)
    // The suggestion wins here because it is listed first, so a hand-
    // edited store cannot make "Fitness" render as "FITNESS".
    expect(fitness[0]?.name).toBe('Fitness')
  })

  it('is stable across repeated merges of the same data', () => {
    const custom: GrowthArea[] = [{ id: 'piano', name: 'Piano', kind: 'custom' }]
    expect(mergeGrowthAreas(custom)).toEqual(mergeGrowthAreas(custom))
  })
})

describe('findById', () => {
  it('returns undefined when nothing matches', () => {
    expect(findById(SUGGESTED_GROWTH_AREAS, 'not-a-real-area')).toBeUndefined()
  })
})
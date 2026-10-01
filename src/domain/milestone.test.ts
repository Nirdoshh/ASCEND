import { describe, expect, it } from 'vitest'

import { HASHED_SUFFIX_CHARACTERS } from './idHash'
import {
  createMilestoneId,
  MAX_MILESTONE_LENGTH,
  MAX_MILESTONES,
  MILESTONE_ID_PREFIX,
  MIN_MILESTONES,
  normalizeMilestone,
  normalizeMilestoneText,
  recoveredMilestoneId,
  toMilestoneText,
  validateMilestoneText,
  type DraftMilestone,
} from './milestone'

/**
 * The milestone rules, tested without a screen.
 *
 * Everything that could go wrong here is a property of the DATA rather than of
 * the UI: an id that moves when the text changes, a blank that gets stored,
 * a duplicate that gets in, a false duplicate that keeps a real answer out.
 * The screens are only ever allowed to display these decisions, so this file is
 * where the decisions have to be right.
 */

function milestone(id: string, text: string): DraftMilestone {
  return { id, text }
}

function refusal(raw: string, existing: readonly DraftMilestone[] = []) {
  const result = validateMilestoneText(raw, existing)
  if (result.ok) throw new Error(`expected ${JSON.stringify(raw)} to be refused`)
  return result
}

function acceptance(raw: string, existing: readonly DraftMilestone[] = []): string {
  const result = validateMilestoneText(raw, existing)
  if (!result.ok) throw new Error(`expected ${JSON.stringify(raw)} to be accepted: ${result.message}`)
  return result.text
}

describe('the limits', () => {
  it('allows between one and five milestones', () => {
    expect(MIN_MILESTONES).toBe(1)
    expect(MAX_MILESTONES).toBe(5)
  })

  it('allows a sentence of a hundred and twenty characters and refuses one more', () => {
    expect(acceptance('y'.repeat(MAX_MILESTONE_LENGTH))).toHaveLength(MAX_MILESTONE_LENGTH)
    expect(refusal('y'.repeat(MAX_MILESTONE_LENGTH + 1)).problem).toBe('too-long')
  })
})

describe('toMilestoneText', () => {
  it('trims the ends and nothing else', () => {
    expect(toMilestoneText('  Run 5 km  ')).toBe('Run 5 km')
  })

  it('keeps the inner spacing, the capitals, the punctuation and the emoji', () => {
    expect(toMilestoneText('  Run  5  km, pain free 🏃  ')).toBe('Run  5  km, pain free 🏃')
  })

  it('treats a blank or whitespace-only box as nothing at all', () => {
    expect(toMilestoneText('')).toBeNull()
    expect(toMilestoneText('     ')).toBeNull()
    expect(toMilestoneText('\t\n ')).toBeNull()
  })
})

describe('normalizeMilestoneText — the duplicate key, and nothing else', () => {
  it('treats a spacing change as the same outcome', () => {
    expect(normalizeMilestoneText('Run 5 km')).toBe(normalizeMilestoneText('run 5km'))
  })

  it('treats a capitalization change as the same outcome', () => {
    expect(normalizeMilestoneText('RUN MY FIRST 5K')).toBe(normalizeMilestoneText('Run my first 5k'))
  })

  it('treats added punctuation as the same outcome', () => {
    expect(normalizeMilestoneText('Run 5 km!')).toBe(normalizeMilestoneText('Run 5 km'))
  })

  it('keeps emoji distinct, so two different ones are not called duplicates', () => {
    // Emoji are `\p{S}`, and stripping symbols would collapse both of these to
    // the empty string — refusing the second as "you already wrote that one",
    // which is a false duplicate. See the note in milestone.ts.
    expect(normalizeMilestoneText('🎹')).not.toBe(normalizeMilestoneText('🥁'))
    expect(normalizeMilestoneText('Practice 🎹')).not.toBe(normalizeMilestoneText('Practice 🥁'))
  })

  it('keeps a currency symbol distinct, which is the price of keeping emoji', () => {
    expect(normalizeMilestoneText('Earn $1000')).not.toBe(normalizeMilestoneText('Earn 1000'))
  })

  it('is not the stored text, and is never allowed to become one', () => {
    // The key exists only to compare. What gets stored is the sentence.
    expect(normalizeMilestoneText('Run 5 km')).toBe('run5km')
    expect(acceptance('  Run 5 km  ')).toBe('Run 5 km')
  })
})

describe('validateMilestoneText', () => {
  it('refuses a blank box', () => {
    expect(refusal('').problem).toBe('empty')
    expect(refusal('    ').problem).toBe('empty')
  })

  it('checks blankness before length, because length is meaningless for a blank', () => {
    expect(refusal(' '.repeat(500)).problem).toBe('empty')
  })

  it('checks length before duplication, because duplication is meaningless for an over-long one', () => {
    const existing = [milestone('ms_a', 'y'.repeat(MAX_MILESTONE_LENGTH + 1))]
    expect(refusal('y'.repeat(MAX_MILESTONE_LENGTH + 1), existing).problem).toBe('too-long')
  })

  it('accepts a single word, because one word is a complete answer', () => {
    expect(acceptance('Piano')).toBe('Piano')
  })

  it('accepts a milestone made only of emoji', () => {
    // Deliberately NOT the Growth Area rule. A Growth Area is a label in a
    // chip grid and "!!!" is visual noise between two real names. A milestone
    // is a sentence in a list, and ASCEND does not inspect vocabulary.
    expect(acceptance('🎹')).toBe('🎹')
  })

  it('accepts any language, unchanged', () => {
    expect(acceptance('沉默。Flush。')).toBe('沉默。Flush。')
    expect(acceptance('Cours 5 km sans m’arrêter')).toBe('Cours 5 km sans m’arrêter')
  })

  it('refuses a duplicate of one already on the list', () => {
    const existing = [milestone('ms_a', 'Run 5 km')]
    expect(refusal('Run 5 km', existing).problem).toBe('duplicate')
  })

  it('refuses a duplicate that differs only by case, spacing or punctuation', () => {
    const existing = [milestone('ms_a', 'Run 5 km')]

    for (const variation of ['run 5km', 'RUN 5 KM', 'run   5   km!', ' Run 5 km ']) {
      expect(refusal(variation, existing).problem, variation).toBe('duplicate')
    }
  })

  it('does NOT treat two different emoji as duplicates', () => {
    const existing = [milestone('ms_a', '🎹')]
    expect(acceptance('🥁', existing)).toBe('🥁')
  })

  it('compares by text and never by id, so a shared id does not hide a duplicate', () => {
    // Two identical sentences have two DIFFERENT ids in practice, so an
    // id-based check would let the same milestone through every time.
    expect(refusal('Run 5 km', [
      milestone('ms_something_else', 'Run 5 km'),
    ]).problem).toBe('duplicate')
  })

  it('accepts a new milestone against a list that does not contain it', () => {
    const existing = [milestone('ms_a', 'Run 5 km'), milestone('ms_b', 'Buy new shoes')]
    expect(acceptance('Book the race', existing)).toBe('Book the race')
  })

  it('never mints an id, because identity is not a side effect of validating', () => {
    // Asserted by the shape of the result: there is no id on it at all.
    const result = validateMilestoneText('Run 5 km', [])
    expect(result).toEqual({ ok: true, text: 'Run 5 km' })
  })
})

describe('createMilestoneId', () => {
  it('is opaque, random-looking and in the milestone namespace', () => {
    const id = createMilestoneId()

    expect(id.startsWith(MILESTONE_ID_PREFIX)).toBe(true)
    expect(id.slice(MILESTONE_ID_PREFIX.length)).toMatch(/^[0-9a-z]{16}$/)
  })

  it('is not the Growth Area prefix, so the two record kinds cannot be confused', () => {
    expect(createMilestoneId().startsWith('ga_')).toBe(false)
    expect(createMilestoneId().startsWith('ms_')).toBe(true)
  })

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createMilestoneId()))
    expect(ids.size).toBe(200)
  })

  it('is one character wider than a recovered id, so a minted id is never mistaken for one', () => {
    const minted = createMilestoneId().slice(MILESTONE_ID_PREFIX.length)
    const recovered = recoveredMilestoneId('Run 5 km').slice(MILESTONE_ID_PREFIX.length)

    expect(minted).toHaveLength(16)
    expect(recovered).toHaveLength(HASHED_SUFFIX_CHARACTERS)
    expect(recovered).toHaveLength(14)
  })
})

describe('recoveredMilestoneId', () => {
  it('is deterministic, so repairing the same draft twice gives the same identity', () => {
    expect(recoveredMilestoneId('Run 5 km')).toBe(recoveredMilestoneId('Run 5 km'))
  })

  it('is stable across a capitalization or spacing change, like the duplicate key', () => {
    expect(recoveredMilestoneId('Run 5 km')).toBe(recoveredMilestoneId('run 5km'))
  })

  it('differs for two different outcomes', () => {
    expect(recoveredMilestoneId('Run 5 km')).not.toBe(recoveredMilestoneId('Run 10 km'))
  })

  it('lives in the milestone namespace', () => {
    expect(recoveredMilestoneId('Run 5 km').startsWith(MILESTONE_ID_PREFIX)).toBe(true)
  })

  it('is NOT used for a milestone that has an id, because identity is never recomputed', () => {
    const stored = normalizeMilestone({ id: 'ms_keepme', text: 'Run 5 km' })
    expect(stored?.id).toBe('ms_keepme')
  })
})

describe('normalizeMilestone', () => {
  it('keeps a good record exactly as it is', () => {
    expect(normalizeMilestone({ id: 'ms_a', text: 'Run 5 km' })).toEqual({
      id: 'ms_a',
      text: 'Run 5 km',
    })
  })

  it('trims the stored text but leaves its wording alone', () => {
    expect(normalizeMilestone({ id: 'ms_a', text: '  Run 5 km 🏃  ' })).toEqual({
      id: 'ms_a',
      text: 'Run 5 km 🏃',
    })
  })

  it('recovers a deterministic id when the stored one is missing or blank', () => {
    const expected = recoveredMilestoneId('Run 5 km')

    expect(normalizeMilestone({ text: 'Run 5 km' })?.id).toBe(expected)
    expect(normalizeMilestone({ id: '', text: 'Run 5 km' })?.id).toBe(expected)
    expect(normalizeMilestone({ id: '   ', text: 'Run 5 km' })?.id).toBe(expected)
    expect(normalizeMilestone({ id: 42, text: 'Run 5 km' })?.id).toBe(expected)
  })

  it('trims a stored id with stray whitespace rather than replacing it', () => {
    expect(normalizeMilestone({ id: '  ms_a  ', text: 'Run 5 km' })?.id).toBe('ms_a')
  })

  it('accepts an id in an unexpected format rather than dropping the sentence', () => {
    expect(normalizeMilestone({ id: 'not-a-normal-id', text: 'Run 5 km' })?.id).toBe(
      'not-a-normal-id',
    )
  })

  it('drops a record with nothing to say', () => {
    expect(normalizeMilestone({ id: 'ms_a', text: '' })).toBeNull()
    expect(normalizeMilestone({ id: 'ms_a', text: '   ' })).toBeNull()
  })

  it('drops a record whose text is not a string', () => {
    expect(normalizeMilestone({ id: 'ms_a', text: 42 })).toBeNull()
    expect(normalizeMilestone({ id: 'ms_a' })).toBeNull()
  })

  it('drops a record that is not an object at all', () => {
    for (const value of [null, undefined, 'Run 5 km', 42, true]) {
      expect(normalizeMilestone(value), String(value)).toBeNull()
    }
  })
})

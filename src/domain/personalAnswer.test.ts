import { describe, expect, it } from 'vitest'

import {
  MAX_GOAL_LENGTH,
  MAX_WHY_LENGTH,
  normalizePersonalAnswer,
  personalAnswerText,
  toPersonalAnswer,
} from './personalAnswer'

/**
 * The rules for a free-text answer.
 *
 * Most of these tests are about NOT doing something. The temptation with
 * a text field is always to help: capitalise the first letter, collapse
 * the double space after a full stop, spell-correct, append a full stop,
 * trim what looks messy. Every one of those is the app rewriting somebody's
 * own words about their own life, so each is pinned down here.
 */

describe('toPersonalAnswer', () => {
  it('keeps a plain sentence exactly as typed', () => {
    expect(toPersonalAnswer('Run my first 10K')).toEqual({ text: 'Run my first 10K' })
  })

  it('returns null rather than an empty answer', () => {
    // The whole reason this function exists. `''` would mean "answered,
    // and the answer is blank", which is a different and false statement.
    expect(toPersonalAnswer('')).toBeNull()
  })

  it('returns null for whitespace only, of every kind', () => {
    for (const blank of [' ', '    ', '\t', '\n', '\n\n  \t\n', ' ', '　']) {
      expect(toPersonalAnswer(blank), JSON.stringify(blank)).toBeNull()
    }
  })

  it('trims whitespace at the ends only', () => {
    expect(toPersonalAnswer('  Run my first 10K  ')).toEqual({ text: 'Run my first 10K' })
    expect(toPersonalAnswer('\n\tRun my first 10K\n')).toEqual({ text: 'Run my first 10K' })
  })

  it('never collapses internal whitespace, unlike a Growth Area name', () => {
    // The contrast with `toGrowthAreaDisplayName` is the entire reason
    // this file is separate from the Growth Area rules. A name is a label
    // and has to line up with a chip grid; a sentence is writing.
    const sentence = 'I ran.  Then I walked.  Then I sat down and thought about it.'

    expect(toPersonalAnswer(sentence)?.text).toBe(sentence)
  })

  it('keeps line breaks the user typed', () => {
    const sentence = 'One day:\n  - play the piano\n  - call my sister'

    expect(toPersonalAnswer(sentence)?.text).toBe(sentence)
  })

  it('keeps capitalization exactly, including a lowercase first letter', () => {
    expect(toPersonalAnswer('run my first 10K')?.text).toBe('run my first 10K')
    expect(toPersonalAnswer('RUN MY FIRST 10K')?.text).toBe('RUN MY FIRST 10K')
    expect(toPersonalAnswer('i want to')?.text).toBe('i want to')
  })

  it('keeps punctuation the user chose', () => {
    // No full stop is added. No comma is added. A question stays a
    // question. What they wrote is what gets stored.
    const sentence = 'Why not?  Really — why not!! (seriously)'

    expect(toPersonalAnswer(sentence)?.text).toBe(sentence)
  })

  it('keeps emoji, including ones that are two code units long', () => {
    // 🙂 is a surrogate pair. A naive `.length` check would count it as two
    // characters, so this test exists to make the trade-off visible rather
    // than accidental: MAX_*_LENGTH is a JS string length, which counts
    // UTF-16 code units, not grapheme clusters.
    const sentence = 'Learn three songs 🎹 and ride a bike 🚴'
    const answer = toPersonalAnswer(sentence)

    expect(answer?.text).toBe(sentence)
    expect(answer?.text.length).toBe(sentence.length)
  })

  it('keeps text in any language, untranslated', () => {
    const answers = [
      '跑我的第一個馬拉松',
      '主要な陇上衣うたい',
      'أن يصبح أفضل',
      'Стать сильнее',
      'বইতে ভালো হতে চাই',
      'Lernen, drei Klavierstücke zu spielen',
    ]

    for (const sentence of answers) {
      expect(toPersonalAnswer(sentence)?.text, sentence).toBe(sentence)
    }
  })

  it('counts length in characters, not bytes', () => {
    // One CJK character is three UTF-8 bytes. A byte-based limit would
    // reject a short sentence in the wrong language roughly three times
    // sooner than the same sentence in English.
    const short = '我要更强'.repeat(50)
    expect(new TextEncoder().encode(short).length).toBeGreaterThan(MAX_GOAL_LENGTH)
    expect(short.length).toBeLessThanOrEqual(MAX_GOAL_LENGTH)
    expect(toPersonalAnswer(short)).not.toBeNull()
  })

  it('has a limit that is a real sentence rather than a single word', () => {
    // Guards against someone "tidying" the numbers down to something that
    // cannot hold what the examples in the UI copy describe.
    expect(MAX_GOAL_LENGTH).toBeGreaterThanOrEqual(100)
    expect(MAX_WHY_LENGTH).toBeGreaterThan(MAX_GOAL_LENGTH)
  })
})

describe('personalAnswerText', () => {
  it('reads the stored text', () => {
    expect(personalAnswerText({ text: 'Run my first 10K' })).toBe('Run my first 10K')
  })

  it('reads an unanswered question as an empty string', () => {
    expect(personalAnswerText(undefined)).toBe('')
  })
})

describe('normalizePersonalAnswer', () => {
  it('accepts this build’s own shape', () => {
    expect(normalizePersonalAnswer({ text: 'Run my first 10K' })).toEqual({
      text: 'Run my first 10K',
    })
  })

  it('accepts a bare string, which is what an older shape stored', () => {
    // Refusing to understand something silently deletes what a person
    // wrote, so leniency wins here.
    expect(normalizePersonalAnswer('Run my first 10K')).toEqual({ text: 'Run my first 10K' })
  })

  it('trims a bare string too', () => {
    expect(normalizePersonalAnswer('  Run my first 10K  ')).toEqual({ text: 'Run my first 10K' })
  })

  it('refuses a blank, so storage corruption cannot fake an answer', () => {
    expect(normalizePersonalAnswer('')).toBeNull()
    expect(normalizePersonalAnswer('   ')).toBeNull()
    expect(normalizePersonalAnswer({ text: '   ' })).toBeNull()
    expect(normalizePersonalAnswer({ text: '' })).toBeNull()
  })

  it('drops everything that is not text at all', () => {
    // These are corruption rather than an older format, and silently
    // keeping one would put an object in front of a screen that expects
    // a sentence.
    for (const junk of [null, undefined, 42, true, {}, { text: 42 }, [], ['Run'], { goal: 'x' }]) {
      expect(normalizePersonalAnswer(junk), JSON.stringify(junk)).toBeNull()
    }
  })

  it('does not apply the length limit, because truncating is a rewrite', () => {
    // An over-long answer stays over-long, and the validator refuses the
    // step so the person gets to fix it themselves. Truncating here
    // would lose the end of their sentence with no way to know.
    const long = 'x'.repeat(MAX_WHY_LENGTH + 50)

    expect(normalizePersonalAnswer({ text: long })).toEqual({ text: long })
  })
})
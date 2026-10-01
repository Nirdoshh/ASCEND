import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrast is enforced, not documented.
 *
 * The ratios written as comments in tokens.css are easy to get wrong,
 * and a design system fails accessibility quietly: someone lightens a
 * grey for a nicer look, and a year later "muted" text is unreadable.
 *
 * So the pairs we depend on are asserted here, against the real token
 * values parsed out of tokens.css. If someone edits a colour, this test
 * fails instead of shipping an unreadable app.
 *
 * Thresholds are WCAG 2.2 AA:
 *   4.5:1  normal text
 *   3.0:1  large text (>= 24px, or >= 18.66px bold) and UI components
 */

const here = dirname(fileURLToPath(import.meta.url))
const tokensSource = readFileSync(resolve(here, 'tokens.css'), 'utf8')

/**
 * Split tokens.css into the light block and the dark block.
 *
 * The dark values appear twice — once in a media query for system
 * preference, once under [data-theme='dark'] for an explicit choice —
 * and they must stay identical. Testing the explicit block is enough,
 * and a separate test asserts the two blocks agree.
 */
function readTokens(scope: 'light' | 'dark'): Map<string, string> {
  const tokens = new Map<string, string>()
  const start =
    scope === 'light' ? 0 : tokensSource.indexOf(":root[data-theme='dark']")
  if (start === -1) throw new Error(`Could not find the ${scope} block in tokens.css`)

  const block = tokensSource.slice(start)
  const pattern = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g

  for (const match of block.matchAll(pattern)) {
    const name = match[1]
    const hex = match[2]
    if (!name || !hex) continue
    // Only the first definition wins, so a value later in the same
    // block cannot silently shadow the one the theme actually uses.
    if (!tokens.has(name)) tokens.set(name, hex)
  }

  return tokens
}

function relativeLuminance(hex: string): number {
  // Expand #abc to #aabbcc so both notations work.
  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex)
  const normalised = shorthand
    ? `#${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}${shorthand[3]}${shorthand[3]}`
    : hex

  if (!/^#[0-9a-f]{6}$/i.test(normalised)) {
    throw new Error(`Unsupported colour value: ${hex}`)
  }

  const red = parseInt(normalised.slice(1, 3), 16) / 255
  const green = parseInt(normalised.slice(3, 5), 16) / 255
  const blue = parseInt(normalised.slice(5, 7), 16) / 255

  const linearise = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)

  return 0.2126 * linearise(red) + 0.7152 * linearise(green) + 0.0722 * linearise(blue)
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const [lighter, darker] = a > b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_TEXT = 4.5

const light = readTokens('light')
const dark = readTokens('dark')

function hexFor(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name)
  if (!value) throw new Error(`Token --${name} was not found in tokens.css`)
  return value
}

/** Every text/surface combination the UI actually renders. */
const TEXT_PAIRS: Array<[scope: 'light' | 'dark', foreground: string, background: string]> = [
  ['light', 'text-primary', 'surface-page'],
  ['light', 'text-primary', 'surface-raised'],
  ['light', 'text-primary', 'surface-sunken'],
  ['light', 'text-secondary', 'surface-page'],
  ['light', 'text-secondary', 'surface-raised'],
  ['light', 'text-secondary', 'surface-sunken'],
  ['light', 'text-muted', 'surface-page'],
  ['light', 'color-accent-text', 'surface-raised'],
  ['light', 'color-accent-text', 'surface-page'],
  ['light', 'color-accent-text', 'color-accent-subtle'],
  ['light', 'text-on-accent', 'color-accent'],
  ['light', 'color-success', 'surface-raised'],
  ['light', 'color-success', 'surface-sunken'],
  ['light', 'color-success', 'color-success-subtle'],
  ['light', 'color-warning', 'surface-raised'],
  ['light', 'color-warning', 'color-warning-subtle'],
  ['light', 'color-danger', 'surface-raised'],
  ['light', 'color-danger', 'surface-page'],
  ['light', 'color-danger', 'color-danger-subtle'],

  ['dark', 'text-primary', 'surface-page'],
  ['dark', 'text-primary', 'surface-raised'],
  ['dark', 'text-primary', 'surface-sunken'],
  ['dark', 'text-secondary', 'surface-page'],
  ['dark', 'text-secondary', 'surface-raised'],
  ['dark', 'text-secondary', 'surface-sunken'],
  ['dark', 'text-muted', 'surface-page'],
  ['dark', 'color-accent-text', 'surface-raised'],
  ['dark', 'color-accent-text', 'surface-page'],
  ['dark', 'color-accent-text', 'color-accent-subtle'],
  ['dark', 'text-on-accent', 'color-accent'],
  ['dark', 'color-success', 'surface-raised'],
  ['dark', 'color-success', 'surface-sunken'],
  ['dark', 'color-success', 'color-success-subtle'],
  ['dark', 'color-warning', 'surface-raised'],
  ['dark', 'color-warning', 'color-warning-subtle'],
  ['dark', 'color-danger', 'surface-raised'],
  ['dark', 'color-danger', 'surface-page'],
  ['dark', 'color-danger', 'color-danger-subtle'],
]

describe('design token contrast (WCAG 2.2 AA)', () => {
  it.each(TEXT_PAIRS)(
    '%s: --%s on --%s meets 4.5:1',
    (scope, foreground, background) => {
      const tokens = scope === 'light' ? light : dark
      const ratio = contrastRatio(
        hexFor(tokens, foreground),
        hexFor(tokens, background),
      )

      expect(
        ratio,
        `--${foreground} on --${background} in ${scope} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXT)
    },
  )

  it('borders used to identify controls meet 3:1', () => {
    // WCAG 1.4.11 Non-text Contrast. The boundary of a control the user
    // must identify has to reach 3:1 against its surface. This is the
    // test that catches a border quietly lightened for aesthetics.
    const checks: Array<['light' | 'dark', string, string]> = [
      ['light', 'border-default', 'surface-raised'],
      ['light', 'border-strong', 'surface-raised'],
      ['dark', 'border-default', 'surface-raised'],
      ['dark', 'border-strong', 'surface-raised'],
    ]

    for (const [scope, border, surface] of checks) {
      const tokens = scope === 'light' ? light : dark
      const ratio = contrastRatio(hexFor(tokens, border), hexFor(tokens, surface))
      expect(ratio, `--${border} on --${surface} in ${scope}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps borders subordinate to the text they sit behind', () => {
    // A border that contrasts harder than the text makes a screen look
    // like a drawing of a form rather than a form. Borders must stay
    // quiet relative to the labels and values.
    for (const scope of ['light', 'dark'] as const) {
      const tokens = scope === 'light' ? light : dark
      const text = contrastRatio(
        hexFor(tokens, 'text-primary'),
        hexFor(tokens, 'surface-raised'),
      )
      const border = contrastRatio(
        hexFor(tokens, 'border-default'),
        hexFor(tokens, 'surface-raised'),
      )
      expect(
        border,
        `--border-default outshines --text-primary in ${scope}`,
      ).toBeLessThan(text)
    }
  })

  it('the focus ring is visible against every surface it can land on', () => {
    // The ring is drawn with `outline-offset: 2px`, so it sits OUTSIDE
    // the element it outlines. Focusing a primary button therefore puts
    // the ring on the page, not on the button's accent fill — which is
    // why --color-accent is deliberately not checked here.
    //
    // The surfaces it really can land on are the ones that sit behind
    // interactive elements: the page, a raised card, a sunken card, and
    // an accent card (which is tinted and holds links).
    for (const scope of ['light', 'dark'] as const) {
      const tokens = scope === 'light' ? light : dark
      for (const surface of [
        'surface-page',
        'surface-raised',
        'surface-sunken',
        'color-accent-subtle',
      ]) {
        const ratio = contrastRatio(hexFor(tokens, 'focus-ring'), hexFor(tokens, surface))
        expect(ratio, `--focus-ring on --${surface} in ${scope}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps the two dark blocks identical', () => {
    // The media query and the explicit attribute must not drift apart.
    // If they do, a user who picks dark mode gets different colours
    // from a user whose device is dark.
    const explicitStart = tokensSource.indexOf(":root[data-theme='dark']")
    const mediaStart = tokensSource.indexOf('@media (prefers-color-scheme: dark)')

    const explicit = new Map<string, string>()
    const media = new Map<string, string>()
    const pattern = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g

    for (const m of tokensSource.slice(explicitStart).matchAll(pattern)) {
      const name = m[1]
      const hex = m[2]
      if (name && hex && !explicit.has(name)) explicit.set(name, hex)
    }
    for (const m of tokensSource.slice(mediaStart, explicitStart).matchAll(pattern)) {
      const name = m[1]
      const hex = m[2]
      if (name && hex && !media.has(name)) media.set(name, hex)
    }

    const mismatches = [...media.keys()].filter((name) => media.get(name) !== explicit.get(name))
    expect(mismatches).toEqual([])
  })
})

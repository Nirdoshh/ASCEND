import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import {
  createOnboardingDraftRepository,
  type OnboardingDraftRepository,
} from '../../data/repositories'
import { createWebStorageStore } from '../../data/storage'
import { ASCEND_ONBOARDING_DRAFT_KEY } from '../../data/storage/keys'
import { GrowthAreasScreen } from './GrowthAreasScreen'
import { OnboardingLayout } from './OnboardingLayout'
import { WelcomeScreen } from './WelcomeScreen'

/**
 * Onboarding tests, driven the way a person drives the screens.
 *
 * Two deliberate choices:
 *
 *   1. These render the REAL router and the REAL layout, not a mocked
 *      one. Most of what this slice has to prove is navigation —
 *      Welcome to Growth Areas, Back, refresh, a cold load of a deep
 *      URL — and a mocked navigate() would only assert that the code
 *      calls a function, not that a person can actually move between
 *      screens.
 *
 *   2. The storage boundary is injected rather than reached into. Tests
 *      that want real persistence pass the real Web Storage store,
 *      because "refresh survives" is a claim about storage. Tests that
 *      need storage to fail pass a store with no storage, because
 *      "survives storage being blocked" is a claim about the repository.
 */

const QUESTION = 'What do you want to improve?'

function localStore(): OnboardingDraftRepository {
  return createOnboardingDraftRepository(createWebStorageStore())
}

function noStore(): OnboardingDraftRepository {
  return createOnboardingDraftRepository(createWebStorageStore(null))
}

/** Mounts the real onboarding routes, exactly as the app does. */
function renderOnboarding(
  { repository = localStore(), startAt = '/onboarding' }: {
    repository?: OnboardingDraftRepository
    startAt?: string
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: '/onboarding',
        element: <OnboardingLayout repository={repository} />,
        children: [
          { index: true, element: <WelcomeScreen /> },
          { path: 'areas', element: <GrowthAreasScreen /> },
        ],
      },
    ],
    { initialEntries: [startAt] },
  )

  return render(<RouterProvider router={router} />)
}

/** Seeds a stored draft, then mounts the app at `startAt`. */
function renderWithStoredDraft(stored: unknown, startAt = '/onboarding') {
  window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(stored))
  return renderOnboarding({ startAt })
}

function readStoredDraft(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
}

function chip(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

async function openComposer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create your own/i }))
  return screen.getByLabelText(QUESTION)
}

beforeEach(() => {
  // React logs every caught render error. The "bad stored data" tests
  // deliberately feed it unusable input, and the noise would bury the
  // real failures.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('the welcome screen', () => {
  it('says what ASCEND is within one glance, with one action', () => {
    renderOnboarding()

    expect(
      screen.getByRole('heading', { level: 1, name: /become the person you want to be/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/one meaningful step at a time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('uses no game, technical or productivity jargon', () => {
    renderOnboarding()

    const text = document.body.textContent ?? ''

    // Word-boundary patterns, not substrings: "quest" is a substring of
    // "question", which is a perfectly good word to use here.
    for (const pattern of [
      /\bquests?\b/i,
      /\bXP\b/,
      /\bpoints?\b/i,
      /\branks?\b/i,
      /\bboss\b/i,
      /\bstreaks?\b/i,
      /gamif/i,
      /productiv/i,
      /onboard/i,
    ]) {
      expect(text, `unexpected jargon matching ${pattern}`).not.toMatch(pattern)
    }
  })

  it('asks for nothing at all before the first question', () => {
    renderOnboarding()

    // No sign-up, no email, no password: nothing is requested before
    // there is a reason to request it.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('leads to the Growth Areas question', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
  })

  it('is operable with the keyboard alone', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    // Skip link first, then the CTA. Enter activates it — no click.
    await user.tab()
    expect(screen.getByRole('link', { name: /skip to the question/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: /start my journey/i })).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
  })

  it('starts a draft on the very first press', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await screen.findByRole('heading', { level: 1, name: QUESTION })

    // Nothing has been answered yet, but the draft exists so that a
    // refresh on step 2 still knows who is asking.
    expect(readStoredDraft()).toMatchObject({ selectedGrowthAreas: [], customGrowthAreas: [] })
  })
})

describe('choosing growth areas', () => {
  it('asks one clear question and offers the ten suggestions', () => {
    renderOnboarding({ startAt: '/onboarding/areas' })

    expect(screen.getByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(screen.getByText(/choose anything that matters to you/i)).toBeInTheDocument()

    for (const name of [
      'Fitness',
      'Learning',
      'Coding',
      'Business',
      'Communication',
      'Creativity',
      'Reading',
      'Money',
      'Confidence',
      'Discipline',
    ]) {
      expect(chip(name)).toBeInTheDocument()
    }
  })

  it('selects and deselects a suggested area', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'false')

    await user.click(chip('Fitness'))
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')

    await user.click(chip('Fitness'))
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'false')
  })

  it('never signals selection with colour alone', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Fitness'))

    // aria-pressed carries the state to assistive technology; the tick
    // carries it visually, which is what makes it survive greyscale and
    // forced-colours mode.
    expect(chip('Fitness').textContent).toContain('✓')
    expect(chip('Reading').textContent).not.toContain('✓')
  })

  it('keeps several choices, in the order they were made', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Reading'))
    await user.click(chip('Fitness'))
    await user.click(chip('Coding'))

    expect(readStoredDraft()?.selectedGrowthAreas).toEqual(['reading', 'fitness', 'coding'])
  })

  it('is fully operable with the keyboard', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    // First stop is the skip link, exactly as in the main app.
    await user.tab()
    expect(screen.getByRole('link', { name: /skip to the question/i })).toHaveFocus()

    await user.tab()
    expect(chip('Fitness')).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')

    await user.tab()
    expect(chip('Learning')).toHaveFocus()

    // Space activates a button, so this works too.
    await user.keyboard(' ')
    expect(chip('Learning')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('creating your own growth area', () => {
  it('creates an area the suggestions do not cover, and selects it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })

  it('behaves exactly like a suggested area once created', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    // Same role, same pressed state, same toggle function. Nothing
    // downstream can tell it apart from a suggestion.
    await user.click(chip('Piano'))
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'false')

    await user.click(chip('Piano'))
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })

  it('asks for nothing but a name', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(screen.getByRole('button', { name: /create your own/i }))

    // Exactly one textbox on the screen. No points, no colour, no
    // difficulty, no priority, no icon, no description.
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    for (const word of [/points?/i, /colou?r/i, /difficult/i, /priorit/i, /level/i, /icon/i]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument()
    }
  })

  it('submits on Enter, without a mouse', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Public speaking{Enter}')

    expect(chip('Public speaking')).toBeInTheDocument()
  })

  it('refuses an empty name and says what to do', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await openComposer(user)
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/type a name for your new area/i)).toBeInTheDocument()
  })

  it('refuses a name that is far too long, without truncating it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'a'.repeat(61))
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/keep it to 60 letters or fewer/i)).toBeInTheDocument()
    // A refused name must leave nothing behind — not even a draft.
    expect(readStoredDraft()?.customGrowthAreas ?? []).toEqual([])
  })

  it('refuses decoration that is not an area', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), '!!!')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/at least one letter or number/i)).toBeInTheDocument()
  })

  it('accepts emoji alongside real words', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Piano 🎹')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(chip('Piano 🎹')).toBeInTheDocument()
  })

  it('accepts a long but legal name', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const name = 'X'.repeat(60)
    await user.type(await openComposer(user), name)
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(chip(name)).toBeInTheDocument()
  })

  it('normalises whitespace and case, keeping the user’s own spelling', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), '  DIGITAL   marketing  ')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(chip('DIGITAL marketing')).toBeInTheDocument()
    expect(readStoredDraft()?.customGrowthAreas).toEqual([
      { id: 'digital marketing', name: 'DIGITAL marketing' },
    ])
  })

  it('refuses a duplicate of a custom area in any casing or spacing', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.type(field, 'Digital Marketing')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    await user.type(field, 'DIGITAL   marketing')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/you already added “Digital Marketing”/i)).toBeInTheDocument()
    expect(readStoredDraft()?.customGrowthAreas).toHaveLength(1)
  })

  it('refuses a duplicate of a suggested area', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), ' FITNESS ')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/you already added “Fitness”/i)).toBeInTheDocument()
  })

  it('clears the complaint as soon as the user starts fixing it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.click(screen.getByRole('button', { name: /add it/i }))
    expect(await screen.findByText(/type a name for your new area/i)).toBeInTheDocument()

    await user.type(field, 'P')

    await waitFor(() => {
      expect(screen.queryByText(/type a name for your new area/i)).not.toBeInTheDocument()
    })
  })

  it('can be cancelled and reopened without leaving a stray input', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.type(field, 'Half-typed')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText(QUESTION)).not.toBeInTheDocument()

    await openComposer(user)
    expect(screen.getByLabelText(QUESTION)).toHaveValue('')
  })
})

describe('an earlier choice changing never destroys work', () => {
  it('keeps a custom area after it is deselected, and lets it come back', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    await user.click(chip('Piano'))
    expect(readStoredDraft()?.selectedGrowthAreas).toEqual([])

    // The definition survives, so re-selecting is instant and the name is
    // unchanged. This is the future-proofing: a Goal written against this
    // area in Phase 2B lives outside the selection list too.
    expect(chip('Piano')).toBeInTheDocument()
    await user.click(chip('Piano'))
    expect(readStoredDraft()?.selectedGrowthAreas).toEqual(['piano'])
    expect(readStoredDraft()?.customGrowthAreas).toEqual([{ id: 'piano', name: 'Piano' }])
  })

  it('deselecting one area leaves the others selected', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Fitness'))
    await user.click(chip('Reading'))
    await user.click(chip('Fitness'))

    expect(readStoredDraft()?.selectedGrowthAreas).toEqual(['reading'])
  })

  it('never records a goal, duration or effort answer in 2A', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Fitness'))
    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    // Later slices' fields cannot hold fake defaults, because they do
    // not exist in the stored shape at all.
    const stored = readStoredDraft() ?? {}
    for (const field of ['goal', 'why', 'durationDays', 'milestones', 'dailyEffortMinutes']) {
      expect(stored, `unexpected “${field}” in the stored draft`).not.toHaveProperty(field)
    }
  })
})

describe('surviving refresh, Back and Forward', () => {
  it('keeps the selection through a refresh', async () => {
    const user = userEvent.setup()
    const first = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))
    await user.click(chip('Reading'))

    // A refresh discards everything React held and keeps storage. Tearing
    // the tree down and re-rendering from the same storage is the closest
    // honest simulation available without a real browser.
    const before = window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)
    first.unmount()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    expect(window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)).toBe(before)
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Reading')).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts a returning user where they left off instead of wiping it', async () => {
    const user = userEvent.setup()
    const first = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))

    first.unmount()
    renderOnboarding()

    expect(
      await screen.findByRole('button', { name: /continue where you left off/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start my journey/i })).not.toBeInTheDocument()
  })

  it('goes Back to the welcome screen and forward again without losing data', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))

    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /become the person/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /continue where you left off/i }))

    expect(await screen.findByRole('button', { name: 'Fitness' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('survives a cold load of the deep URL for the second step', async () => {
    // This is the case that broke in production in Phase 1: a cold load
    // of a client route. It must render the step, not a blank screen.
    renderWithStoredDraft(
      {
        schemaVersion: 1,
        currentStep: 'growth-areas',
        selectedGrowthAreas: ['fitness', 'piano'],
        customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
        startedAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-01T09:00:00.000Z',
      },
      '/onboarding/areas',
    )

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('when storage is unavailable', () => {
  it('still works, and says honestly that answers will not be kept', async () => {
    const user = userEvent.setup()
    renderOnboarding({ repository: noStore(), startAt: '/onboarding/areas' })

    expect(
      await screen.findByText(/this browser is not letting ASCEND save/i),
    ).toBeInTheDocument()

    await user.click(chip('Fitness'))

    // The choice still works on screen. Only persistence is missing, and
    // the app says so rather than pretending it saved.
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not throw, and does not clear anything the user already had', async () => {
    const user = userEvent.setup()
    const preferences = '{"schemaVersion":1,"theme":"dark"}'
    window.localStorage.setItem('ascend:preferences:v1', preferences)

    renderOnboarding({ repository: noStore(), startAt: '/onboarding/areas' })
    await screen.findByText(/not letting ASCEND save/i)
    await user.click(chip('Fitness'))
    await user.click(chip('Reading'))

    // Storage being broken must never become an excuse to delete data.
    expect(window.localStorage.getItem('ascend:preferences:v1')).toBe(preferences)
  })

  it('warns once the draft exists, with wording about not closing the tab', async () => {
    const user = userEvent.setup()
    renderOnboarding({ repository: noStore() })

    expect(await screen.findByText(/anything.*disappear if you close the tab/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))

    expect(
      await screen.findByText(/answers are safe while this page is open/i),
    ).toBeInTheDocument()
  })
})

describe('recovering from bad stored data', () => {
  it('starts clean instead of crashing on a corrupt draft', async () => {
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, '{ not json at all')

    renderOnboarding()

    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('starts clean on a draft from a version it cannot migrate', async () => {
    renderWithStoredDraft({ schemaVersion: 0, selectedGrowthAreas: ['fitness'] })

    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('keeps what it understands from a NEWER version of the app', async () => {
    // A schema mismatch in the *other* direction must not throw away
    // answers a person gave to a newer build.
    renderWithStoredDraft(
      {
        schemaVersion: 99,
        currentStep: 'growth-areas',
        selectedGrowthAreas: ['fitness'],
        customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
        goal: 'a goal from a build we do not have',
      },
      '/onboarding/areas',
    )

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Piano')).toBeInTheDocument()
  })

  it('drops a selection that names an area which no longer exists', async () => {
    renderWithStoredDraft(
      {
        schemaVersion: 1,
        currentStep: 'growth-areas',
        selectedGrowthAreas: ['fitness', 'retired-in-a-later-build'],
        customGrowthAreas: [],
      },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    // The dangling id is dropped rather than displayed: we cannot show
    // the user a choice they apparently made but can no longer see.
    expect(
      screen.queryByRole('button', { name: 'Retired in a later build' }),
    ).not.toBeInTheDocument()
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
  })

  it('is usable even on a cold deep link with no draft at all', async () => {
    // A refresh or a pasted URL on step 2 must not dead-end. Before this
    // was fixed the screen rendered zero Growth Areas and a Continue
    // button that could never be pressed.
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Fitness')).toBeInTheDocument()

    await user.click(chip('Coding'))

    expect(chip('Coding')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('lets a custom area be created on a cold deep link too', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })

  it('survives a stored draft that is not an object at all', async () => {
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(['fitness']))

    renderOnboarding()

    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })
})

describe('continuing', () => {
  it('cannot be pressed until something is chosen, and says why', async () => {
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    expect(screen.getByText(/pick at least one to continue/i)).toBeInTheDocument()
  })

  it('is enabled once something is chosen, and counts the choices', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.click(chip('Fitness'))
    await user.click(chip('Reading'))

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    expect(screen.getByText(/2 chosen/i)).toBeInTheDocument()
  })

  it('says plainly that the next step is not built, rather than going nowhere', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.click(chip('Fitness'))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/not built yet/i)).toBeInTheDocument()
    expect(readStoredDraft()?.currentStep).toBe('goal')
  })

  it('still creates no journey and no real data', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.click(chip('Fitness'))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/not built yet/i)

    // The draft is the ONLY thing written anywhere. Phase 2A creates no
    // Journey, no Day 1 plan and no points.
    expect(Object.keys(window.localStorage)).toEqual([ASCEND_ONBOARDING_DRAFT_KEY])
  })
})

describe('not the main application', () => {
  it('shows no main navigation, because there is nothing to navigate to yet', async () => {
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    // The four product screens would all be empty and would imply a
    // Journey that does not exist.
    expect(screen.queryByRole('navigation', { name: /main/i })).not.toBeInTheDocument()
  })
})
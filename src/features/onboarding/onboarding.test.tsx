import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import {
  createOnboardingDraftRepository,
  type OnboardingDraftRepository,
} from '../../data/repositories'
import { createWebStorageStore } from '../../data/storage'
import { ASCEND_ONBOARDING_DRAFT_KEY } from '../../data/storage/keys'
import { suggestedGrowthAreaId } from '../../domain/growthAreaId'
import { ONBOARDING_SCHEMA_VERSION } from '../../domain/onboardingDraft'
import { MAX_GOAL_LENGTH, MAX_WHY_LENGTH } from '../../domain/personalAnswer'
import { GoalScreen } from './GoalScreen'
import { GrowthAreasScreen } from './GrowthAreasScreen'
import { OnboardingLayout } from './OnboardingLayout'
import { WelcomeScreen } from './WelcomeScreen'
import { WhyScreen } from './WhyScreen'

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
const GOAL_QUESTION = 'What would you love to achieve?'
const WHY_QUESTION = 'Why does this matter to you?'

/**
 * Words ASCEND must never use, in any screen.
 *
 * Kept here as one list because it is a product rule rather than a
 * property of any one screen, and the first two onboarding steps are the
 * only place a growth-focused app is tempted to reach for game language:
 * it is the vocabulary that makes progress feel like a game rather than
 * like work.
 */
const BANNED_WORDS = [
  /\bquests?\b/i,
  /\bXP\b/,
  /\bpoints?\b/i,
  /\branks?\b/i,
  /\bboss\b/i,
  /\bstreaks?\b/i,
  /gamif/i,
  /productiv/i,
  /onboard/i,
]

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
          { path: 'goal', element: <GoalScreen /> },
          { path: 'why', element: <WhyScreen /> },
        ],
      },
    ],
    { initialEntries: [startAt] },
  )

  // The router is returned alongside the render result so a test can drive
  // the browser's own Back and Forward buttons (router.navigate(-1) / (1))
  // rather than only the in-app Back link.
  return { ...render(<RouterProvider router={router} />), router }
}

/** Seeds a stored draft, then mounts the app at `startAt`. */
function renderWithStoredDraft(stored: unknown, startAt = '/onboarding') {
  window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(stored))
  return renderOnboarding({ startAt })
}

/**
 * A realistic stored draft: one area chosen, nothing else answered.
 *
 * Built from a real suggestion id rather than hand-written, so fixtures
 * cannot drift away from the shape the app actually writes — which is how
 * a test ends up proving something true only of a shape nothing produces.
 */
function sampleStoredDraft() {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    currentStep: 'growth-areas',
    selectedGrowthAreaIds: [suggestedGrowthAreaId('fitness')],
    customGrowthAreas: [],
    startedAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  }
}

/**
 * The same draft, carrying one answer field.
 *
 * `currentStep` is set past the field, which is what a user who pressed
 * Continue and then came Back would really have — so the tests are
 * exercising the resume rule at the same time as the storage rule.
 */
function storedDraftWith(field: 'goal' | 'why', answer: { text: string }) {
  return {
    ...sampleStoredDraft(),
    currentStep: field === 'goal' ? 'why' : 'duration',
    [field]: answer,
  }
}

function readStoredDraft(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(ASCEND_ONBOARDING_DRAFT_KEY)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
}

function storedCustomAreas(): { id: string; name: string; normalizedName: string }[] {
  return (readStoredDraft()?.customGrowthAreas ?? []) as {
    id: string
    name: string
    normalizedName: string
  }[]
}

function storedSelection(): string[] {
  return (readStoredDraft()?.selectedGrowthAreaIds ?? []) as string[]
}

/**
 * Forces the in-memory draft back out to storage without changing it.
 *
 * Load-time repair — reconciling a dangling id, rebuilding a missing one,
 * overwriting a stale normalizedName — happens in memory and is only
 * persisted when something changes. That is deliberate: reconciling on
 * every load would mean writing during the first render, and storage is
 * blocked for some users. So a test asserting the *stored* result of a
 * repair has to touch something first. Clicking an unselected chip twice
 * triggers the write and leaves the selection exactly as it was.
 */
async function flushDraftToStorage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(chip('Coding'))
  await user.click(chip('Coding'))
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
    for (const pattern of BANNED_WORDS) {
      expect(text, `unexpected jargon matching ${pattern}`).not.toMatch(pattern)
    }
  })

  it('sends a returning visitor to the step they actually reached', async () => {
    // The bug this replaced: "Continue where you left off" pointed at
    // /onboarding/areas for everyone, so a user who had already answered
    // the Goal and the WHY was dropped back onto the chips.
    const user = userEvent.setup()
    const first = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })

    // A refresh discards React entirely and keeps storage.
    first.unmount()
    renderOnboarding()

    await user.click(await screen.findByRole('button', { name: /continue where you left off/i }))

    expect(await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })).toBeInTheDocument()
  })

  it('offers a fresh start to someone whose draft has no answers in it', async () => {
    // A draft existing is not the same as a draft having been answered.
    // "Continue where you left off" for a person who has answered nothing
    // is a lie, and the destination would be the page they are already on.
    window.localStorage.setItem(
      ASCEND_ONBOARDING_DRAFT_KEY,
      JSON.stringify({
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: [],
        customGrowthAreas: [],
        startedAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-01T09:00:00.000Z',
      }),
    )
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(await screen.findByRole('button', { name: /start my journey/i }))

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
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
    expect(readStoredDraft()).toMatchObject({ selectedGrowthAreaIds: [], customGrowthAreas: [] })
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

    // Stored as ids, not names. A name here would break the moment the
    // user corrected a spelling.
    expect(storedSelection()).toEqual([
      suggestedGrowthAreaId('reading'),
      suggestedGrowthAreaId('fitness'),
      suggestedGrowthAreaId('coding'),
    ])
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

    // The comparison key is normalised; the id is NOT derived from the
    // name at all. This is the correction in one assertion: two people
    // typing the same thing get two different areas, and renaming this
    // one could never break a reference to it.
    expect(storedCustomAreas()).toEqual([
      {
        id: expect.stringMatching(/^ga_c_[0-9a-z]{16}$/),
        name: 'DIGITAL marketing',
        normalizedName: 'digital marketing',
      },
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
    expect(storedCustomAreas()).toHaveLength(1)
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

/**
 * The composer only ever reports one outcome.
 *
 * Found by driving a real browser rather than by reading the code: add an
 * area, press Cancel, press "+ Create your own" again, and the
 * confirmation from the first add was still on screen — so a live region
 * was announcing an add that happened a minute and a click ago. Worse, a
 * refused duplicate rendered the refusal and the stale confirmation
 * together, which is two contradictory sentences about the same press.
 *
 * The rule these tests pin: the confirmation describes one submission, and
 * anything that ends that submission — closing the composer, or the app
 * refusing the next one — takes the confirmation with it.
 */
describe('the composer reporting exactly one outcome', () => {
  /** The confirmation is the only role="status" on a healthy screen. */
  function confirmation(): string | null {
    return screen.queryByRole('status')?.textContent ?? null
  }

  it('does not greet a reopened composer with the last add', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.type(field, 'Digital Marketing')
    await user.click(screen.getByRole('button', { name: /add it/i }))
    expect(await screen.findByText('Digital Marketing added.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await openComposer(user)

    // The area itself survives — that is the promise the whole split
    // between definition and selection rests on. Only the announcement of
    // the previous press is gone.
    expect(chip('Digital Marketing')).toBeInTheDocument()
    expect(storedCustomAreas()).toHaveLength(1)
    expect(screen.getByLabelText(QUESTION)).toHaveValue('')
    await waitFor(() => {
      expect(confirmation()).toBeNull()
    })
  })

  it('never shows a confirmation and a refusal at the same time', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.type(field, 'Digital Marketing')
    await user.click(screen.getByRole('button', { name: /add it/i }))
    expect(await screen.findByText('Digital Marketing added.')).toBeInTheDocument()

    // Same composer, still open, second press refused. The refusal is the
    // only thing that should be on screen: it is the one about to matter.
    await user.type(field, ' Fitness')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText(/you already added “Fitness”/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/added\.$/)).not.toBeInTheDocument()
    })
    expect(confirmation()).toBeNull()
    expect(storedCustomAreas()).toHaveLength(1)
  })

  it('keeps the confirmation while the next name is being typed', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    const field = await openComposer(user)
    await user.type(field, 'Digital Marketing')
    await user.click(screen.getByRole('button', { name: /add it/i }))
    expect(await screen.findByText('Digital Marketing added.')).toBeInTheDocument()

    // Not cleared by typing, and that is deliberate. A refusal is stale the
    // moment they start fixing it, because it is about the box; this is not
    // about the box at all, it is about the list, and it is still true —
    // it is also the answer to "why did that chip just appear?".
    await user.type(field, 'Pi')
    expect(screen.getByText('Digital Marketing added.')).toBeInTheDocument()
    expect(field).toHaveValue('Pi')

    // A second success REPLACES it rather than stacking, so the status
    // region never grows into a list of everything ever added.
    await user.clear(field)
    await user.type(field, 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    expect(await screen.findByText('Piano added.')).toBeInTheDocument()
    expect(screen.queryByText('Digital Marketing added.')).not.toBeInTheDocument()
    expect(confirmation()).toBe('Piano added.')
    expect(storedCustomAreas()).toHaveLength(2)
  })
})

describe('an earlier choice changing never destroys work', () => {
  it('keeps a custom area after it is deselected, and lets it come back', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))

    await user.click(chip('Piano'))
    expect(storedSelection()).toEqual([])

    // The definition survives, so re-selecting is instant and the name is
    // unchanged. This is the future-proofing: Phase 2C's milestones are
    // keyed by this same id, so a toggle here can never orphan one.
    expect(chip('Piano')).toBeInTheDocument()
    await user.click(chip('Piano'))

    const id = storedCustomAreas()[0]?.id
    expect(storedSelection()).toEqual([id])
    expect(storedCustomAreas()).toEqual([{ id, name: 'Piano', normalizedName: 'piano' }])
  })

  it('deselecting one area leaves the others selected', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Fitness'))
    await user.click(chip('Reading'))
    await user.click(chip('Fitness'))

    expect(storedSelection()).toEqual([suggestedGrowthAreaId('reading')])
  })

  it('never records a duration, milestone or effort answer in 2B', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await user.click(chip('Fitness'))
    await user.type(await openComposer(user), 'Piano')
    await user.click(screen.getByRole('button', { name: /add it/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
    await user.type(screen.getByLabelText(WHY_QUESTION), 'Because I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/not built yet/i)

    // Phase 2C's fields cannot hold fake defaults, because they do not
    // exist in the stored shape at all. Only the two fields this phase
    // really implemented are present.
    const stored = readStoredDraft() ?? {}
    expect(Object.keys(stored).sort()).toEqual([
      'currentStep',
      'customGrowthAreas',
      'goal',
      'schemaVersion',
      'selectedGrowthAreaIds',
      'startedAt',
      'updatedAt',
      'why',
    ])
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

  it('follows the browser Back and Forward buttons, because the URL is the step', async () => {
    // The in-app Back link is one thing; the browser's chrome is another,
    // and it is the one a phone user actually reaches for. Every step has
    // its own URL precisely so these work with no extra code, and this is
    // the test that would fail if a step were ever rendered as local state
    // instead of as a route.
    const user = userEvent.setup()
    const { router } = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })

    // Back twice: WHY -> Goal -> Areas.
    await act(async () => {
      await router.navigate(-1)
    })
    expect(await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })).toBeInTheDocument()

    await act(async () => {
      await router.navigate(-1)
    })
    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()

    // Forward again, in order, and the Goal is still there.
    await act(async () => {
      await router.navigate(1)
    })
    expect(await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })).toBeInTheDocument()
    expect(screen.getByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')

    await act(async () => {
      await router.navigate(1)
    })
    expect(await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })).toBeInTheDocument()
  })

  it('survives a cold load of the deep URL for the second step', async () => {
    // This is the case that broke in production in Phase 1: a cold load
    // of a client route. It must render the step, not a blank screen.
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: [suggestedGrowthAreaId('fitness'), 'ga_c_pianofixed01'],
        customGrowthAreas: [
          { id: 'ga_c_pianofixed01', name: 'Piano', normalizedName: 'piano' },
        ],
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

describe('a real Phase 2A draft after the identity correction', () => {
  // These fixtures are the exact bytes a shipped Phase 2A build wrote:
  // `selectedGrowthAreas` holding normalized NAMES, and a custom area
  // whose `id` WAS its normalized name. They are deliberately not updated
  // to the new shape, because keeping them is the only way to prove that
  // a real user's draft still opens. Two migrations now run over them —
  // v1 -> v2 and v2 -> v3 — which is exactly the path a real user's data
  // takes on first load of this build.
  const PHASE_2A_DRAFT = {
    schemaVersion: 1,
    currentStep: 'growth-areas',
    selectedGrowthAreas: ['fitness', 'piano'],
    customGrowthAreas: [{ id: 'piano', name: 'Piano' }],
    startedAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:05:00.000Z',
  }

  it('keeps every choice the user had already made', async () => {
    renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the custom area’s own capitalization', async () => {
    renderWithStoredDraft(
      { ...PHASE_2A_DRAFT, customGrowthAreas: [{ id: 'digital marketing', name: 'Digital Marketing' }] },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(chip('Digital Marketing')).toHaveAttribute('aria-pressed', 'false')
  })

  it('resolves selections written as normalized names to the new ids', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await flushDraftToStorage(user)

    expect(storedSelection()).toEqual([
      suggestedGrowthAreaId('fitness'),
      // Hashed from the name, so the same draft always migrates to the
      // same identity. A random id here would make the user's selection
      // vanish on the next page load.
      expect.stringMatching(/^ga_m_[0-9a-z]{14}$/),
    ])
    expect(storedCustomAreas()[0]).toEqual({
      id: expect.stringMatching(/^ga_m_[0-9a-z]{14}$/),
      name: 'Piano',
      normalizedName: 'piano',
    })
  })

  it('is rewritten at the current schema version, with the old field removed', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await flushDraftToStorage(user)

    expect(readStoredDraft()).toMatchObject({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
    })
    expect(readStoredDraft()).not.toHaveProperty('selectedGrowthAreas')
  })

  it('lets the migrated draft be edited like any other', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    await user.click(chip('Piano'))
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    // The custom area definition is still there to come back to.
    expect(chip('Piano')).toBeInTheDocument()

    await user.click(chip('Piano'))
    expect(chip('Piano')).toHaveAttribute('aria-pressed', 'true')
  })

  it('produces the same ids every time, so nothing drifts between loads', async () => {
    const first = renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')
    await screen.findByRole('heading', { level: 1, name: QUESTION })
    const firstIds = storedSelection()
    first.unmount()

    renderWithStoredDraft(PHASE_2A_DRAFT, '/onboarding/areas')
    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(storedSelection()).toEqual(firstIds)
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

  it('keeps a typed Goal on screen, and still lets the user move on', async () => {
    // The exact promise this app makes when storage fails: nothing the
    // user typed disappears while the page is open. Validation reads the
    // in-memory draft, so the step is still completable — only the
    // persistence is missing, and the warning says so.
    const user = userEvent.setup()
    renderOnboarding({ repository: noStore(), startAt: '/onboarding/goal' })

    await screen.findByText(/not letting ASCEND save/i)

    const field = screen.getByLabelText(GOAL_QUESTION)
    await user.type(field, 'Run my first 10K')

    expect(field).toHaveValue('Run my first 10K')
    expect(screen.getByText(/this browser is not letting ASCEND save/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Moving on proves the answer counted, even though it was never stored.
    expect(await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })).toBeInTheDocument()
    expect(readStoredDraft()).toBeNull()
  })

  it('keeps a typed WHY on screen when storage is blocked', async () => {
    const user = userEvent.setup()
    renderOnboarding({ repository: noStore(), startAt: '/onboarding/why' })

    await screen.findByText(/not letting ASCEND save/i)

    const field = screen.getByLabelText(WHY_QUESTION)
    await user.type(field, 'Because I want to prove I can')

    expect(field).toHaveValue('Because I want to prove I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // No Journey, no draft, and an honest note rather than a fake success.
    expect(await screen.findByText(/not built yet/i)).toBeInTheDocument()
    expect(readStoredDraft()).toBeNull()
  })
})

describe('recovering from bad stored data', () => {
  it('starts clean instead of crashing on a corrupt draft', async () => {
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, '{ not json at all')

    renderOnboarding()

    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('starts clean on a draft from a version it cannot migrate', async () => {
    renderWithStoredDraft({ schemaVersion: 0, selectedGrowthAreaIds: ['ga_fitness'] })
    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('never overwrites a draft written by a NEWER version of the app', async () => {
    // The failure this prevents: an older build loads a newer draft, does
    // not recognise its fields, and writes the recognised ones back — which
    // deletes the rest. Refusing is the only safe half; nothing is written,
    // so the newer build still finds every answer. See ADR 0011.
    const newer = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION + 1,
      currentStep: 'goal',
      selectedGrowthAreaIds: [suggestedGrowthAreaId('fitness')],
      customGrowthAreas: [],
      goal: { text: 'an answer from a newer build' },
      startedAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z',
    }
    const user = userEvent.setup()
    renderWithStoredDraft(newer, '/onboarding/areas')

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    // A tap is a normal action, and it is exactly what used to persist the
    // lossy rewrite. Two taps put the selection back, so nothing the app did
    // is left half-applied either.
    await user.click(chip('Fitness'))
    await user.click(chip('Fitness'))

    expect(readStoredDraft()).toEqual(newer)
  })

  it('opens the Goal screen on a stored goal that is not text, with an empty box', async () => {
    // Hand-edited or half-migrated storage. The sentence is gone and
    // there is nothing honest to show, so the question is simply asked
    // again rather than the screen crashing or displaying "42".
    renderWithStoredDraft({ ...sampleStoredDraft(), goal: 42 }, '/onboarding/goal')

    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('')
  })

  it('keeps a good Goal when the stored WHY beside it is corrupt', async () => {
    // The two answers are independent, so damage to one must not take the
    // other with it. This is the field-at-a-time normalisation, asserted
    // where a user would notice it.
    renderWithStoredDraft(
      { ...sampleStoredDraft(), goal: { text: 'Run my first 10K' }, why: ['nope'] },
      '/onboarding/why',
    )

    expect(await screen.findByLabelText(WHY_QUESTION)).toHaveValue('')
    expect(readStoredDraft()?.goal).toEqual({ text: 'Run my first 10K' })
  })

  it('reads a Goal stored as a bare string, from a shape this build never wrote', async () => {
    // Leniency at the storage boundary is what stops an older build's
    // shape from silently deleting something a person wrote.
    renderWithStoredDraft(
      { ...sampleStoredDraft(), goal: '  Run my first 10K  ' },
      '/onboarding/goal',
    )

    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')
  })

  it('drops a selection that names an area which no longer exists', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(
      {
        schemaVersion: 2,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: ['ga_fitness', 'ga_retiredina-later-build'],
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

    await flushDraftToStorage(user)
    expect(storedSelection()).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('drops a selection that holds a bare name, which is not an id', async () => {
    // Hand-edited storage, or a half-finished migration. "fitness" was an
    // id in Phase 2A, so this is a realistic thing to find.
    const user = userEvent.setup()
    renderWithStoredDraft(
      { schemaVersion: 2, currentStep: 'growth-areas', selectedGrowthAreaIds: ['fitness'] },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'false')

    await flushDraftToStorage(user)
    expect(storedSelection()).toEqual([])
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
    window.localStorage.setItem(ASCEND_ONBOARDING_DRAFT_KEY, JSON.stringify(['ga_fitness']))

    renderOnboarding()

    expect(await screen.findByRole('button', { name: /start my journey/i })).toBeInTheDocument()
  })

  it('survives a custom area stored with no id at all', async () => {
    // Repaired deterministically, so the same draft yields the same area
    // on every load instead of a new identity each time.
    const user = userEvent.setup()
    renderWithStoredDraft(
      { schemaVersion: 2, currentStep: 'growth-areas', customGrowthAreas: [{ name: 'Piano' }] },
      '/onboarding/areas',
    )

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Piano')).toBeInTheDocument()

    await flushDraftToStorage(user)
    expect(storedCustomAreas()[0]?.id).toMatch(/^ga_m_[0-9a-z]{14}$/)
  })

  it('repairs a tampered normalizedName from the name it belongs to', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        customGrowthAreas: [
          { id: 'ga_c_fixed', name: 'Piano', normalizedName: 'something else entirely' },
        ],
      },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    // The id is read (identity is never re-derived) but the derived
    // comparison key is recomputed, so duplicate detection still works.
    await flushDraftToStorage(user)
    expect(storedCustomAreas()[0]).toEqual({
      id: 'ga_c_fixed',
      name: 'Piano',
      normalizedName: 'piano',
    })
  })

  it('keeps an area whose id is in a format it does not recognise', async () => {
    // Rejecting an unfamiliar id would silently delete somebody's growth
    // area. Carrying it in an odd shape costs nothing.
    const user = userEvent.setup()
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        customGrowthAreas: [{ id: 'legacy_piano', name: 'Piano' }],
      },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(chip('Piano')).toBeInTheDocument()

    await flushDraftToStorage(user)
    expect(storedCustomAreas()[0]?.id).toBe('legacy_piano')
  })
})

describe('continuing', () => {
  it('cannot be pressed until something is chosen, and says why', async () => {
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    // The wording comes from the domain validator, so the reason the
    // button is disabled is stated in exactly one place.
    expect(screen.getByText(/choose at least one growth area/i)).toBeInTheDocument()
  })

  it('explains a disabled Continue that has nothing to do with the count', async () => {
    // A selection the screen cannot display is a different problem from
    // an empty one, and gets a different message. This branch is only
    // reachable from stored data, which is why it lives here.
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'goal',
        selectedGrowthAreaIds: ['ga_goneina-later-build'],
      },
      '/onboarding/areas',
    )

    await screen.findByRole('heading', { level: 1, name: QUESTION })

    // A dangling id is reconciled away on load, so the screen honestly
    // asks for a choice rather than reporting a selection it cannot show.
    expect(screen.getByText(/choose at least one growth area/i)).toBeInTheDocument()
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

  it('goes on to the Goal question, which now exists', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.click(chip('Fitness'))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })).toBeInTheDocument()
    // The pointer moved with the user, and the choices are still stored.
    expect(readStoredDraft()?.currentStep).toBe('goal')
    expect(storedSelection()).toEqual([suggestedGrowthAreaId('fitness')])
  })

  it('still creates no journey and no real data, two steps later', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/areas' })

    await screen.findByRole('heading', { level: 1, name: QUESTION })
    await user.click(chip('Fitness'))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
    await user.type(screen.getByLabelText(WHY_QUESTION), 'Because I want to prove I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/not built yet/i)

    // The draft is the ONLY thing written anywhere. Phase 2B creates no
    // Journey, no Day 1 plan and no points.
    expect(Object.keys(window.localStorage)).toEqual([ASCEND_ONBOARDING_DRAFT_KEY])
  })

  it('refuses to go on with no Goal, and says what is missing', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // The wording comes from the domain validator, and focus is taken to
    // the field that needs fixing rather than only announced.
    expect(await screen.findByText(/tell us what you would love to achieve/i)).toBeInTheDocument()
    expect(screen.getByLabelText(GOAL_QUESTION)).toHaveFocus()
  })

  it('refuses to go on with a Goal that is only whitespace', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), '    ')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/tell us what you would love to achieve/i)).toBeInTheDocument()
    // Nothing was stored, because a field of spaces is not an answer.
    expect(readStoredDraft()?.goal).toBeUndefined()
  })

  it('refuses to go on with a Goal that is far too long, without truncating it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    // Pasted, not typed: pasting a long sentence is how somebody produces
    // one, and the DOM cap has to apply to a paste too.
    await user.click(await screen.findByLabelText(GOAL_QUESTION))
    await user.paste('x'.repeat(MAX_GOAL_LENGTH + 1))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(
      await screen.findByText(new RegExp(`keep your goal to ${MAX_GOAL_LENGTH} characters or fewer`, 'i')),
    ).toBeInTheDocument()

    // The sentence they wrote is still exactly what they wrote, so they can
    // shorten it rather than starting again.
    expect((readStoredDraft()?.goal as { text: string } | undefined)?.text).toHaveLength(
      MAX_GOAL_LENGTH + 1,
    )
  })
})

describe('the goal question', () => {
  it('asks one question and offers one way to answer it', () => {
    renderOnboarding({ startAt: '/onboarding/goal' })

    expect(
      screen.getByRole('heading', { level: 1, name: GOAL_QUESTION }),
    ).toBeInTheDocument()
    // A textarea, not a text input: a goal is a sentence, and a one-line
    // box on a phone scrolls a sentence sideways.
    expect(screen.getByLabelText(GOAL_QUESTION).tagName).toBe('TEXTAREA')
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
  })

  it('offers no templates, no examples to pick and no choices at all', () => {
    // The place a growth app is most tempted to hand out a menu of goals.
    // The only thing between the user and the box is an illustrative
    // placeholder, which is not selectable, not validated and not
    // suggested.
    renderOnboarding({ startAt: '/onboarding/goal' })

    expect(screen.getByPlaceholderText('Run my first 10K')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('uses no game, technical or productivity jargon', () => {
    renderOnboarding({ startAt: '/onboarding/goal' })

    for (const pattern of BANNED_WORDS) {
      expect(document.body.textContent ?? '', pattern.source).not.toMatch(pattern)
    }
  })

  it('stores a sentence exactly as written, minus the padding around it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    await user.type(screen.getByLabelText(GOAL_QUESTION), '  Run my first 10K  ')

    expect(readStoredDraft()?.goal).toEqual({ text: 'Run my first 10K' })
  })

  it('keeps punctuation, emoji and any language exactly as written', async () => {
    const user = userEvent.setup()
    const answers = [
      'Why not?  Really — why not!! (seriously)',
      'Learn three songs 🎹 and ride a bike 🚴',
      '跑我的第一個馬拉松',
      'Освоить три песни, сыграть их наизусть',
    ]

    for (const answer of answers) {
      // Each answer gets a genuinely fresh person. Storage outlives the
      // unmount, so without this the second iteration would load the
      // first one's answer and append to it.
      window.localStorage.clear()
      const view = renderOnboarding({ startAt: '/onboarding/goal' })

      await user.type(screen.getByLabelText(GOAL_QUESTION), answer)
      await user.click(screen.getByRole('button', { name: /continue/i }))

      // The stored text is byte-identical, and the app moved on rather
      // than correcting, translating or complaining.
      expect(readStoredDraft()?.goal, answer).toEqual({ text: answer })
      await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
      view.unmount()
    }
  })

  it('accepts an answer of exactly the maximum length', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    await user.click(await screen.findByLabelText(GOAL_QUESTION))
    await user.paste('x'.repeat(MAX_GOAL_LENGTH))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
  })

  it('saves as the user types, so closing the tab cannot lose a sentence', async () => {
    // The order of operations is the product promise, not an optimisation.
    // A refresh before Continue must not lose what was written.
    const user = userEvent.setup()
    const first = renderOnboarding({ startAt: '/onboarding/goal' })

    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    expect(readStoredDraft()?.goal).toEqual({ text: 'Run my first 10K' })

    first.unmount()
    renderOnboarding({ startAt: '/onboarding/goal' })

    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')
  })

  it('removes the answer when the user empties the box', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(
      {
        ...storedDraftWith('goal', { text: 'Run my first 10K' }),
      },
      '/onboarding/goal',
    )

    await screen.findByLabelText(GOAL_QUESTION)
    await user.clear(screen.getByLabelText(GOAL_QUESTION))

    expect(readStoredDraft()).not.toHaveProperty('goal')
  })

  it('goes Back to the Growth Areas with the choices intact', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(storedDraftWith('goal', { text: 'Run my first 10K' }), '/onboarding/goal')

    await screen.findByLabelText(GOAL_QUESTION)
    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
    // Going Back must not be a way to lose the answer either.
    expect(readStoredDraft()?.goal).toEqual({ text: 'Run my first 10K' })
  })

  it('is fully operable with the keyboard alone', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/goal' })

    await screen.findByLabelText(GOAL_QUESTION)

    // First stop is the skip link, exactly as on every other screen.
    await user.tab()
    expect(screen.getByRole('link', { name: /skip to the question/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText(GOAL_QUESTION)).toHaveFocus()

    await user.keyboard('Run my first 10K')
    await user.tab()
    expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus()

    // Back is reachable too. A text step that can only be left forwards
    // is a trap for exactly the keyboard users who cannot easily guess
    // a gesture on a phone.
    await user.tab()
    expect(screen.getByRole('button', { name: /^back$/i })).toHaveFocus()

    // Shift-Tab goes back up the same order, which is what makes the
    // screen usable in both directions without a mouse.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus()
    await user.keyboard('{Enter}')

    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
  })

  it('opens with an empty box on a cold deep link, with no draft at all', () => {
    renderOnboarding({ startAt: '/onboarding/goal' })

    expect(screen.getByLabelText(GOAL_QUESTION)).toHaveValue('')
    expect(readStoredDraft()).toBeNull()
  })

  it('opens a real Phase 2A draft, which has no goal field, without complaint', () => {
    // The shape the previous build wrote, byte for byte. No `goal` key, no
    // `why` key: an unanswered question must be readable as unanswered, not
    // as broken.
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: [suggestedGrowthAreaId('fitness')],
        customGrowthAreas: [],
        startedAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-01T09:00:00.000Z',
      },
      '/onboarding/goal',
    )

    expect(screen.getByLabelText(GOAL_QUESTION)).toHaveValue('')
  })
})

describe('why it matters to you', () => {
  it('asks the question and says what the answer is for', () => {
    renderOnboarding({ startAt: '/onboarding/why' })

    expect(screen.getByRole('heading', { level: 1, name: WHY_QUESTION })).toBeInTheDocument()
    // The supporting copy is the promise, not decoration: this is the one
    // answer the app will read back on a bad day.
    expect(
      screen.getByText(/when things get difficult, we.ll remind you why you started/i),
    ).toBeInTheDocument()
  })

  it('uses no game, technical or productivity jargon', () => {
    renderOnboarding({ startAt: '/onboarding/why' })

    for (const pattern of BANNED_WORDS) {
      expect(document.body.textContent ?? '', pattern.source).not.toMatch(pattern)
    }
  })

  it('stores the sentence exactly as written, minus the padding around it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await user.type(screen.getByLabelText(WHY_QUESTION), '  Because I want to prove I can.  ')

    expect(readStoredDraft()?.why).toEqual({ text: 'Because I want to prove I can.' })
  })

  it('keeps punctuation, emoji and any language exactly as written', async () => {
    const user = userEvent.setup()
    const answers = ['Because I can 🚀', 'My pupils asked why I was sad 🙁', '沉默。Flush。']

    for (const answer of answers) {
      // Fresh person each time, for the same reason as the Goal test.
      window.localStorage.clear()
      const view = renderOnboarding({ startAt: '/onboarding/why' })

      await user.type(await screen.findByLabelText(WHY_QUESTION), answer)
      expect(readStoredDraft()?.why, answer).toEqual({ text: answer })
      view.unmount()
    }
  })

  it('refuses to go on with nothing written', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await screen.findByLabelText(WHY_QUESTION)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/tell us why this matters to you/i)).toBeInTheDocument()
    expect(screen.getByLabelText(WHY_QUESTION)).toHaveFocus()
    // Nothing was ever written, so there is no draft to hold an answer
    // and nothing for the user to undo.
    expect(readStoredDraft()?.why).toBeUndefined()
  })

  it('refuses to go on with whitespace only', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await user.type(await screen.findByLabelText(WHY_QUESTION), '     ')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/tell us why this matters to you/i)).toBeInTheDocument()
    // A field of spaces is removed, not stored as an answer.
    expect(readStoredDraft()?.why).toBeUndefined()
  })

  it('refuses to go on with an answer past the maximum length, without truncating it', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    // Pasted rather than typed, because pasting a long sentence is how
    // somebody actually produces one, and because the DOM cap is applied
    // on paste too.
    await user.click(await screen.findByLabelText(WHY_QUESTION))
    await user.paste('y'.repeat(MAX_WHY_LENGTH + 1))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(
      await screen.findByText(new RegExp(`keep it to ${MAX_WHY_LENGTH} characters or fewer`, 'i')),
    ).toBeInTheDocument()
    // The whole sentence they wrote is still there to shorten.
    expect((readStoredDraft()?.why as { text: string } | undefined)?.text).toHaveLength(
      MAX_WHY_LENGTH + 1,
    )
  })

  it('accepts an answer of exactly the maximum length', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await user.click(await screen.findByLabelText(WHY_QUESTION))
    await user.paste('y'.repeat(MAX_WHY_LENGTH))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/not built yet/i)).toBeInTheDocument()
  })

  it('says plainly where the build stops, and offers a way back', async () => {
    // Phase 2C's duration question does not exist. A Continue button that
    // quietly goes nowhere, or a success screen for something unbuilt,
    // would be the most dishonest thing this step could do.
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await user.type(await screen.findByLabelText(WHY_QUESTION), 'Because I want to prove I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/not built yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /change my answer/i }))

    expect(await screen.findByLabelText(WHY_QUESTION)).toHaveValue('Because I want to prove I can')
  })

  it('keeps the answer after a refresh, and still lets it be changed', async () => {
    const user = userEvent.setup()
    const first = renderOnboarding({ startAt: '/onboarding/why' })

    await user.type(await screen.findByLabelText(WHY_QUESTION), 'Because I want to prove I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/not built yet/i)

    first.unmount()
    renderOnboarding({ startAt: '/onboarding/why' })

    expect(await screen.findByLabelText(WHY_QUESTION)).toHaveValue(
      'Because I want to prove I can',
    )
  })

  it('goes Back to the Goal with the goal intact', async () => {
    const user = userEvent.setup()
    renderWithStoredDraft(
      {
        ...storedDraftWith('goal', { text: 'Run my first 10K' }),
        why: { text: 'Because I want to prove I can' },
      },
      '/onboarding/why',
    )

    await screen.findByLabelText(WHY_QUESTION)
    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')
    expect(readStoredDraft()?.why).toEqual({ text: 'Because I want to prove I can' })
  })

  it('is fully operable with the keyboard alone', async () => {
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await screen.findByLabelText(WHY_QUESTION)

    await user.tab()
    expect(screen.getByRole('link', { name: /skip to the question/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText(WHY_QUESTION)).toHaveFocus()

    await user.keyboard('Because I can')
    await user.tab()
    expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByText(/not built yet/i)

    // From the boundary note the way back is still reachable. Two stops,
    // because Continue was replaced rather than moved: the focused element
    // is gone, so focus starts over at the top of the document.
    await user.tab()
    expect(screen.getByRole('link', { name: /skip to the question/i })).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(WHY_QUESTION)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /change my answer/i })).toHaveFocus()
  })

  it('never invents a reason on the user’s behalf', async () => {
    // A WHY that ASCEND made up would be worth nothing on the day somebody
    // needs to hear it, and the app would have no way to know.
    const user = userEvent.setup()
    renderOnboarding({ startAt: '/onboarding/why' })

    await user.type(await screen.findByLabelText(WHY_QUESTION), 'Because I can')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/not built yet/i)

    expect(readStoredDraft()?.why).toEqual({ text: 'Because I can' })
  })
})

describe('moving between the two new steps', () => {
  it('goes Areas to Goal to WHY and back again, losing nothing', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /start my journey/i }))
    await user.click(await screen.findByRole('button', { name: 'Fitness' }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByRole('heading', { level: 1, name: GOAL_QUESTION })
    await user.type(screen.getByLabelText(GOAL_QUESTION), 'Run my first 10K')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByRole('heading', { level: 1, name: WHY_QUESTION })
    await user.type(screen.getByLabelText(WHY_QUESTION), 'Because I want to prove I can')
    await user.click(screen.getByRole('button', { name: /^back$/i }))

    // Back to the Goal, still holding both answers.
    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')
    expect(readStoredDraft()?.why).toEqual({ text: 'Because I want to prove I can' })

    await user.click(screen.getByRole('button', { name: /^back$/i }))

    // And back to the chips, still selected.
    expect(await screen.findByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
    expect(chip('Fitness')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps a Goal when every Growth Area it was written alongside is deselected', async () => {
    // ADR 0009 and 0010 together, and the reason they do not contradict
    // each other. A goal that belongs to the Journey rather than to one
    // area cannot be orphaned by a deselection, so there is nothing for
    // the Summary to have to resolve later — and nothing is lost now.
    const user = userEvent.setup()
    const view = renderOnboarding({ startAt: '/onboarding/goal' })

    await user.type(await view.findByLabelText(GOAL_QUESTION), 'Run my first 10K')
    view.unmount()

    // The state that deselection leaves behind: no areas at all, but a
    // Goal still stored. Hand-written because getting there through the
    // UI is impossible — Continue is correctly disabled with nothing
    // chosen — which is exactly why the storage layer has to be tested
    // directly.
    renderWithStoredDraft(
      {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        currentStep: 'growth-areas',
        selectedGrowthAreaIds: [],
        customGrowthAreas: [],
        goal: { text: 'Run my first 10K' },
        startedAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-01T09:00:00.000Z',
      },
      '/onboarding/goal',
    )

    expect(await screen.findByLabelText(GOAL_QUESTION)).toHaveValue('Run my first 10K')
    expect(storedSelection()).toEqual([])
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
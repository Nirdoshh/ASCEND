import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addDailyStep } from '../../application/dailySteps'
import { getOrCreateTodayPlan } from '../../application/todayPlan'
import { setTodayWin } from '../../application/todayWin'
import { TodayScreen } from './TodayScreen'
import {
  defaultDailyStepsRepository,
} from '../../data/repositories/defaults'
import { createDailyPlanRepository } from '../../data/repositories/dailyPlanRepository'
import { createDailyStepsRepository } from '../../data/repositories/dailyStepsRepository'
import { createJourneyRepository } from '../../data/repositories/journeyRepository'
import { createTodayWinRepository } from '../../data/repositories/todayWinRepository'
import { createWebStorageStore } from '../../data/storage'
import { createJourneyFromDraft } from '../../domain/journey'
import { createFixedLocalDateProvider } from '../../domain/localDate'
import { ONBOARDING_SCHEMA_VERSION, knownGrowthAreas, type OnboardingDraft } from '../../domain/onboardingDraft'

const NOW = '2026-10-01T09:00:00.000Z'

async function seedToday(stepTexts = ['First action', 'Second action']) {
  const store = createWebStorageStore()
  const journeyRepository = createJourneyRepository(store)
  const planRepository = createDailyPlanRepository(store)
  const winRepository = createTodayWinRepository(store)
  const stepsRepository = createDailyStepsRepository(store)
  const draft = {
    selectedGrowthAreaIds: ['ga_s_fitness'],
    customGrowthAreas: [],
    goal: { text: 'Run my first 10K' },
    why: { text: 'Because I can' },
    durationDays: 30,
    milestones: [{ id: 'ms_first', text: 'Run 5 km' }],
    dailyEffortMinutes: 20,
  }
  const journeyDraft: OnboardingDraft = {
    ...draft,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    currentStep: 'daily-effort',
    startedAt: NOW,
    updatedAt: NOW,
  }
  const journey = createJourneyFromDraft(draft, knownGrowthAreas(journeyDraft), NOW, 'jr_test1234567890')
  journeyRepository.save(journey)

  const planResult = await getOrCreateTodayPlan(
    journeyRepository,
    planRepository,
    createFixedLocalDateProvider('2026-10-01'),
    NOW,
  )
  if (!planResult.ok) throw new Error('Expected a DailyPlan')
  const winResult = await setTodayWin(journeyRepository, planRepository, winRepository, 'Deploy the auth flow', NOW)
  if (!winResult.ok) throw new Error('Expected a Today Win')

  for (const text of stepTexts) {
    const result = await addDailyStep(planRepository, stepsRepository, journeyRepository, winRepository, text)
    if (!result.ok) throw new Error('Expected a Daily Step')
  }
}

function renderToday() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <TodayScreen />
    </MemoryRouter>,
  )
}

describe('Today Daily Step completion UI', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('provides keyboard-operable checkbox semantics and persists completion', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = renderToday()

    const checkbox = await screen.findByRole('checkbox', { name: /complete step 1/i })
    expect(checkbox).not.toBeChecked()
    checkbox.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(checkbox).toBeChecked())

    first.unmount()
    renderToday()
    expect(await screen.findByRole('checkbox', { name: /mark step 1/i })).toBeChecked()
  })

  it('acknowledges completion only when every existing step is complete', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()

    await user.click(await screen.findByRole('checkbox', { name: /complete step 1/i }))
    await user.click(await screen.findByRole('checkbox', { name: /complete step 2/i }))

    expect(await screen.findByText('Today’s steps are complete.')).toBeInTheDocument()
  })

  it('shows persistence feedback when completion cannot be saved', async () => {
    await seedToday()
    vi.spyOn(defaultDailyStepsRepository, 'save').mockReturnValue('unavailable')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()

    await user.click(await screen.findByRole('checkbox', { name: /complete step 1/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save Daily Steps.')
    expect(screen.getByRole('checkbox', { name: /complete step 1/i })).not.toBeChecked()
  })

  it('focuses the Win editor and restores its Edit control after cancel and save', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    const edit = await screen.findByRole('button', { name: /^edit$/i })
    await user.click(edit)
    expect(screen.getByRole('textbox', { name: /today.s win/i })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /^edit$/i })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /save today.s win/i }))
    expect(await screen.findByRole('button', { name: /^edit$/i })).toHaveFocus()
  })

  it('focuses a Step editor and restores the initiating control after save or cancel', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    await user.click(await screen.findByRole('button', { name: 'Edit step 1' }))
    expect(screen.getByRole('textbox', { name: 'Edit step 1' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Edit step 1' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Edit step 1' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Edit step 1' })).toHaveFocus()
  })

  it('relocates focus to the next Step, then the composer after removing the last Step', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    await user.click(await screen.findByRole('button', { name: 'Remove step 1' }))
    expect(screen.getByRole('button', { name: 'Edit step 1' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Remove step 1' }))
    expect(screen.getByRole('textbox', { name: 'Add a step' })).toHaveFocus()
  })

  it('submits the Add Step and edit forms with Enter and names the undo action', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    const add = await screen.findByRole('textbox', { name: 'Add a step' })
    await user.type(add, 'Walk outside{Enter}')
    expect(await screen.findByText('Walk outside')).toBeInTheDocument()
    expect(add).toHaveFocus()
    expect(screen.getByText('Step added.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit step 3' }))
    const edit = screen.getByRole('textbox', { name: 'Edit step 3' })
    await user.clear(edit)
    await user.type(edit, 'Walk to the park{Enter}')
    expect(await screen.findByText('Walk to the park')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit step 3' })).toHaveFocus()
    await user.click(screen.getByRole('checkbox', { name: 'Complete step 3: Walk to the park' }))
    expect(await screen.findByRole('checkbox', { name: 'Mark step 3 incomplete: Walk to the park' })).toBeChecked()
  })

  it('submits Today’s Win with Enter and preserves wording', async () => {
    await seedToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    await user.click(await screen.findByRole('button', { name: /^edit$/i }))
    const field = screen.getByRole('textbox', { name: /today.s win/i })
    await user.clear(field)
    await user.type(field, 'Read a chapter{Enter}')
    expect(await screen.findByText('Read a chapter')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toHaveFocus()
  })

  it('shows a removal persistence error even when all four Step slots are filled', async () => {
    await seedToday(['One', 'Two', 'Three', 'Four'])
    vi.spyOn(defaultDailyStepsRepository, 'save').mockReturnValue('unavailable')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    await user.click(await screen.findByRole('button', { name: 'Remove step 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save Daily Steps.')
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Remove step 1' })).toHaveFocus()
  })
})

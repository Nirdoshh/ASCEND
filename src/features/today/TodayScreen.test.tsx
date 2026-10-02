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
})


import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressScreen } from './ProgressScreen'
import { defaultJourneyRepository, defaultDailyPlanRepository } from '../../data/repositories/defaults'
import { dailyPlanStorageKey } from '../../domain/dailyPlan'
import { dailyStepsStorageKey } from '../../domain/dailyStep'
import { progressJourney, progressSourceDay, PROGRESS_NOW } from '../../test/progressFixtures'

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(PROGRESS_NOW))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function seedDay(date: string, completions: boolean[]) {
  const source = progressSourceDay(date, completions)
  window.localStorage.setItem(dailyPlanStorageKey(source.plan.journeyId, date), JSON.stringify(source.plan))
  window.localStorage.setItem(dailyStepsStorageKey(source.plan.id), JSON.stringify(source.steps))
  return source
}

function renderProgress() {
  return render(<MemoryRouter><ProgressScreen /></MemoryRouter>)
}

describe('Progress screen', () => {
  it('offers Journey creation when rendered without an active Journey', () => {
    renderProgress()
    expect(screen.getByText('Start with a Journey')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create a Journey' })).toHaveAttribute('href', '/onboarding')
    expect(screen.queryByText('Actions completed')).not.toBeInTheDocument()
  })

  it('shows an honest no-history state and factual Journey day', () => {
    defaultJourneyRepository.save(progressJourney())
    renderProgress()
    expect(screen.getByText('No completed actions yet')).toBeInTheDocument()
    expect(screen.getByText('Your Journey is ready. Your first action starts on Today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/today')
    expect(screen.getByText('Day 11 of 45')).toBeInTheDocument()
    expect(screen.getByText('Calendar time since you started, not goal completion.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recent activity' })).not.toBeInTheDocument()
  })

  it('handles plans with no steps without a zero-heavy activity display', () => {
    defaultJourneyRepository.save(progressJourney())
    seedDay('2026-10-11', [])
    renderProgress()
    expect(screen.getByText('Your plans are here. Add small actions on Today to get started.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows open steps as open while offering a first action', () => {
    defaultJourneyRepository.save(progressJourney())
    seedDay('2026-10-11', [false, false])
    renderProgress()
    expect(screen.getByText('Your steps are ready. Complete an action on Today when you’ve done it.')).toBeInTheDocument()
    expect(screen.getByText('Active on 0 of the last 7 days')).toBeInTheDocument()
    expect(screen.getByText('0/2')).toBeInTheDocument()
    expect(screen.queryByText(/You’re taking action/)).not.toBeInTheDocument()
  })

  it('shows Journey action count, plain-language consistency and accessible seven-day history', () => {
    defaultJourneyRepository.save(progressJourney())
    seedDay('2026-10-01', [true, true])
    seedDay('2026-10-08', [true, false, true])
    seedDay('2026-10-10', [true, true])
    seedDay('2026-10-11', [false, false])
    renderProgress()
    const total = screen.getByRole('region', { name: 'Actions completed' })
    expect(within(total).getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Active on 2 of the last 7 days')).toBeInTheDocument()
    const history = screen.getByRole('list', { name: /last 7 calendar days/ })
    expect(within(history).getAllByRole('listitem')).toHaveLength(7)
    expect(within(history).getByText(/October 8, 2026: 2 of 3 actions completed/)).toBeInTheDocument()
    expect(within(history).getByText(/October 10, 2026: 2 of 2 actions completed. All steps complete/)).toBeInTheDocument()
    expect(within(history).getByText(/October 11, 2026: 0 of 2 actions completed/)).toBeInTheDocument()
    expect(within(history).getAllByText(/No plan recorded/)).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
  })

  it('describes pre-Journey days and one-step composition honestly', () => {
    defaultJourneyRepository.save(progressJourney('2026-10-10T09:00:00Z'))
    seedDay('2026-10-11', [true])
    renderProgress()
    expect(screen.getByText('Active on 1 of the last 7 days')).toBeInTheDocument()
    expect(screen.getAllByText(/Before this Journey/)).toHaveLength(5)
    expect(screen.getByText(/1 of 1 actions completed. Step set incomplete/)).toBeInTheDocument()
    expect(screen.queryByText(/All steps complete/)).not.toBeInTheDocument()
    expect(screen.getByText('Day 2 of 45')).toBeInTheDocument()
  })

  it('distinguishes a plan without steps within partial recent history', () => {
    defaultJourneyRepository.save(progressJourney())
    seedDay('2026-10-10', [])
    seedDay('2026-10-11', [true, false])
    renderProgress()
    expect(screen.getByText(/October 10, 2026: No steps recorded/)).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('reports unreadable history without showing inaccurate partial totals or deleting it', () => {
    defaultJourneyRepository.save(progressJourney())
    const source = seedDay('2026-10-11', [true, false])
    const key = dailyStepsStorageKey(source.plan.id)
    window.localStorage.setItem(key, '{broken')
    renderProgress()
    expect(screen.getByRole('alert')).toHaveTextContent('Your records have been kept')
    expect(screen.queryByRole('region', { name: 'Actions completed' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(key)).toBe('{broken')
  })

  it('explains future-schema history without interpreting it', () => {
    defaultJourneyRepository.save(progressJourney())
    window.localStorage.setItem(dailyPlanStorageKey('jr_progress', '2026-10-11'), JSON.stringify({ schemaVersion: 99 }))
    renderProgress()
    expect(screen.getByRole('alert')).toHaveTextContent('Open the latest version to read it')
  })

  it('provides a keyboard-operable retry when storage becomes available', async () => {
    defaultJourneyRepository.save(progressJourney())
    const spy = vi.spyOn(defaultDailyPlanRepository, 'listForJourney')
      .mockReturnValueOnce({ ok: false, problem: 'storage-unavailable' })
    renderProgress()
    expect(screen.getByRole('alert')).toHaveTextContent('Try again when storage is available')
    const retry = screen.getByRole('button', { name: 'Try again' })
    retry.focus()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No completed actions yet')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('recalculates on return from Today after completion is undone', () => {
    defaultJourneyRepository.save(progressJourney())
    seedDay('2026-10-11', [true, false])
    const view = renderProgress()
    expect(screen.getByText('Active on 1 of the last 7 days')).toBeInTheDocument()
    view.unmount()
    seedDay('2026-10-11', [false, false])
    renderProgress()
    expect(screen.getByText('No completed actions yet')).toBeInTheDocument()
    expect(screen.getByText('Active on 0 of the last 7 days')).toBeInTheDocument()
  })
})

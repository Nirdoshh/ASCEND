import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { TodayRedirect, todayLoader } from '../../app/StartupRedirect'
import { ASCEND_JOURNEY_KEY } from '../../data/storage/keys'
import { progressJourney } from '../../test/progressFixtures'
import { PreferencesProvider } from '../../app/PreferencesProvider'

const delayed = vi.hoisted(() => ({ release: undefined as (() => void) | undefined }))
vi.mock('./TodayScreen', async () => {
  await new Promise<void>((resolve) => { delayed.release = resolve })
  return { TodayScreen: () => <h2>Loaded plan</h2> }
})

it('keeps Today oriented and announces loading until its lazy route is ready', async () => {
  window.localStorage.setItem(ASCEND_JOURNEY_KEY, JSON.stringify(progressJourney()))
  const router = createMemoryRouter([{ path: '/today', loader: todayLoader, Component: TodayRedirect, HydrateFallback: () => null }], {
    initialEntries: ['/today'],
  })
  render(<PreferencesProvider><RouterProvider router={router} /></PreferencesProvider>)
  expect(await screen.findByRole('heading', { name: 'Today', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading today’s plan')
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  expect(document.querySelector('.today')).toHaveAttribute('aria-busy', 'true')
  await act(async () => { delayed.release?.() })
  expect(await screen.findByRole('heading', { name: 'Loaded plan' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  router.dispose()
})

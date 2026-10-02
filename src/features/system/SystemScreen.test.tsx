import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SystemScreen } from './SystemScreen'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})
afterEach(() => vi.unstubAllGlobals())

function expectActiveScreen(label: string, heading: string) {
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  // Both responsive navigation presentations must follow the visible screen.
  for (const nav of screen.getAllByRole('navigation', { name: 'System sections' })) {
    expect(within(nav).getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  }
}

describe('System navigation', () => {
  it.each([0, 1])('keeps both navigation presentations in sync using keyboard navigation from presentation %i', async (index) => {
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    expectActiveScreen('Today', 'Today')

    const destinations = [
      ['Path', 'A bigger you.'],
      ['Status', 'SYSTEM STATUS'],
      ['You', 'Build something real.'],
      ['Today', 'Today'],
    ] as const
    const nav = screen.getAllByRole('navigation', { name: 'System sections' })[index]!
    for (const [label, heading] of destinations) {
      within(nav).getByRole('button', { name: label }).focus()
      await user.keyboard('{Enter}')
      expectActiveScreen(label, heading)
    }
  })

  it('selects Path after content navigation and completion, without a preceding navigation click', async () => {
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await user.click(screen.getByRole('button', { name: 'View Path' }))
    expectActiveScreen('Path', 'A bigger you.')
    await user.click(within(screen.getAllByRole('navigation', { name: 'System sections' })[0]!).getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('checkbox', { name: /Complete status UI/ }))
    expectActiveScreen('Path', 'A bigger you.')
    expect(screen.getByRole('button', { name: 'Status UI, action. Focus branch' })).toHaveClass('is-active')
    expect(document.querySelector('.graph-stage')).toHaveClass('is-pulsing')
  })

  it('keeps normal navigation hidden during Lock-In, including after objective completion', async () => {
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await user.click(screen.getByRole('button', { name: 'ENTER LOCK-IN' }))
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Complete status UI/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Finish the payment workflow.' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('creates and edits a real Goal from the selected Path', async () => {
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await user.click(screen.getAllByRole('button', { name: 'Path' })[0]!)
    await user.click(screen.getByRole('button', { name: /Add Goal/ }))
    await user.type(screen.getByLabelText('Title'), 'Run 5K')
    await user.type(screen.getByLabelText('WHY'), 'Build steady stamina')
    await user.click(screen.getByRole('button', { name: 'Create Goal' }))
    expect(screen.getByRole('heading', { name: 'Run 5K' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Run 10K')
    await user.click(screen.getByRole('button', { name: 'Save Goal' }))
    expect(screen.getByRole('heading', { name: 'Run 10K' })).toBeInTheDocument()
  })

  it('supports pause, resume, complete, and archive controls', async () => {
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await user.click(screen.getAllByRole('button', { name: 'Path' })[0]!)
    await user.click(screen.getByRole('button', { name: /Add Goal/ }))
    await user.type(screen.getByLabelText('Title'), 'Strength practice')
    await user.click(screen.getByRole('button', { name: 'Create Goal' }))
    await user.click(screen.getAllByRole('button', { name: 'Pause' }).at(-1)!)
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument()
  })
})

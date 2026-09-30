import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { PrimaryNav } from './PrimaryNav'

/**
 * Navigation tests.
 *
 * These exist to protect the two accessibility bugs that are easiest to
 * introduce and hardest to notice:
 *   1. A "/" link without `end` is active on every route, so "Today"
 *      would look selected while the user is on Journey.
 *   2. Rendering separate mobile and desktop navs would double the
 *      links a screen reader walks through.
 */
function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PrimaryNav />
    </MemoryRouter>,
  )
}

describe('PrimaryNav', () => {
  it('renders exactly the four approved destinations', () => {
    renderNav()

    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('marks only the current page as current', () => {
    renderNav('/journey')

    const journey = screen.getByRole('link', { name: /journey/i })
    const today = screen.getByRole('link', { name: /today/i })

    expect(journey).toHaveAttribute('aria-current', 'page')
    expect(today).not.toHaveAttribute('aria-current', 'page')
  })

  it('marks Today as current on / but not on other routes', () => {
    const { unmount } = renderNav('/')
    expect(screen.getByRole('link', { name: /today/i })).toHaveAttribute('aria-current', 'page')
    unmount()

    renderNav('/progress')
    expect(screen.getByRole('link', { name: /today/i })).not.toHaveAttribute('aria-current', 'page')
  })

  it('renders a single nav element, not one per breakpoint', () => {
    renderNav()

    // One <nav> that CSS repositions. Two navs would mean duplicate links.
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
  })

  it('gives each link a descriptive accessible name', () => {
    renderNav()

    expect(screen.getByRole('link', { name: /what should i do right now/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /where am i going/i })).toBeInTheDocument()
  })

  it('navigates when activated', async () => {
    const user = userEvent.setup()
    renderNav('/')

    await user.click(screen.getByRole('link', { name: /journey/i }))

    expect(screen.getByRole('link', { name: /journey/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../app/PreferencesProvider'
import { AppHeader } from './AppHeader'

/**
 * A small integration test for the theme control.
 *
 * We test the control itself (not the whole app) because AppShell
 * depends on react-router's Navigation, and this is a focused check of
 * the preference seam: clicking the button must cycle the theme and
 * the accessible name must reflect the action.
 */
describe('AppHeader theme control', () => {
  it('cycles theme on click and announces the next action', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <PreferencesProvider>
          <AppHeader />
        </PreferencesProvider>
      </BrowserRouter>,
    )

    const button = screen.getByRole('button', {
      name: /colour theme: match my device\. switch to light/i,
    })

    await user.click(button)

    // After first click: system -> light
    expect(
      screen.getByRole('button', { name: /colour theme: light\. switch to dark/i }),
    ).toBeInTheDocument()

    await user.click(button)

    // light -> dark
    expect(
      screen.getByRole('button', { name: /colour theme: dark\. switch to match my device/i }),
    ).toBeInTheDocument()
  })
})

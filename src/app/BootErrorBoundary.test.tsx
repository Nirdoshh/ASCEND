import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, useLocation } from 'react-router-dom'

import { App } from '../App'
import { BootErrorBoundary } from './BootErrorBoundary'
import { PreferencesProvider } from './PreferencesProvider'

/**
 * Boot failure tests.
 *
 * `BootErrorBoundary` is the last line of defence, so the thing worth
 * proving is not that it looks right but that it works with as little as
 * possible around it. Every test here renders it with **no** router, no
 * `PreferencesProvider` and no providers of any kind, because that is
 * exactly the situation it exists for.
 *
 * Test 4 proves the absence of router context rather than assuming it: if
 * a router hook can still be used in this environment, then "the fallback
 * rendered without router context" would be a meaningless claim.
 */
function Explodes(): ReactElement {
  throw new Error('INTERNAL_FAILURE_TOKEN: preferences repository unavailable')
}

const RELOAD_LABEL = 'Reload ASCEND'

/**
 * jsdom's `window.location.reload` is non-configurable, so it cannot be
 * spied on directly (`vi.spyOn` throws "Cannot redefine property"). We
 * replace the `location` object itself instead, keeping the real one as
 * the prototype so nothing else that reads it is affected, and restoring
 * it in `afterEach` so the replacement cannot leak into other files.
 */
function stubReload() {
  const original = window.location
  const reload = vi.fn()

  const stub = Object.create(original) as Location
  Object.defineProperty(stub, 'reload', { value: reload })

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: stub,
  })

  return {
    reload,
    restore: () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: original,
      })
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BootErrorBoundary', () => {
  // The composition itself. Phase 1 shipped a crash that lived entirely in
  // the order of these three elements, and every other test rendered a
  // component in isolation, so nothing noticed. `App` uses no hooks, so it
  // can be called directly to inspect the element tree it returns.
  it('is the outermost element of the application, above preferences and the router', () => {
    // `React.ReactElement` defaults its props to `unknown` in React 19's
    // types, so the shape has to be stated before we can walk into it.
    type Node = ReactElement<{ children?: ReactNode }>

    const tree = App() as Node
    const preferences = tree.props.children as Node
    const router = preferences.props.children as Node

    expect(tree.type).toBe(BootErrorBoundary)
    expect(preferences.type).toBe(PreferencesProvider)
    expect(router.type).toBe(RouterProvider)
  })

  // 1. The normal application is untouched by the boundary's presence.
  it('does not interfere with the normal application', () => {
    render(<App />)

    // Beta V1 opens the System independently of the legacy Journey guard.
    expect(screen.getByRole('heading', { name: 'Become visible to yourself.', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter the System/i })).toBeInTheDocument()
  })

  // 2 + 3 + 5. A child throws during render; the boundary catches it and
  // the error never reaches the caller.
  it('catches a child that throws during render and shows the fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    let escaped = false
    try {
      render(
        <BootErrorBoundary>
          <Explodes />
        </BootErrorBoundary>,
      )
    } catch {
      escaped = true
    }

    expect(escaped).toBe(false)

    expect(
      // The apostrophe is typographic (&rsquo;) so the heading reads
      // correctly in a screen reader; `.` matches either form.
      screen.getByRole('heading', { name: /ASCEND couldn.t start/i, level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your data is still safe.')).toBeInTheDocument()
    expect(screen.getByText('Try reloading the app.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: RELOAD_LABEL })).toBeInTheDocument()
  })

  // 4. Proves there genuinely is no router context here, so the test above
  // is not passing by accident.
  it('renders correctly even though no router context exists', () => {
    expect(() => render(<Explodes />)).toThrow()

    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <BootErrorBoundary>
        <Explodes />
      </BootErrorBoundary>,
    )

    // A router hook would throw in this environment, which is exactly
    // what makes the absence of context a verified fact.
    function NeedsRouter() {
      useLocation()
      return null
    }
    expect(() => render(<NeedsRouter />)).toThrow()

    // And the fallback offers the navigation route a router hook would.
    expect(screen.getByRole('button', { name: RELOAD_LABEL })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main/i })).not.toBeInTheDocument()
  })

  // The fallback must never leak internals to the user.
  it('never exposes the error message, a stack trace or internal detail', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <BootErrorBoundary>
        <Explodes />
      </BootErrorBoundary>,
    )

    const text = document.body.textContent ?? ''

    expect(text).not.toContain('INTERNAL_FAILURE_TOKEN')
    expect(text).not.toContain('preferences repository unavailable')
    expect(text).not.toContain('Error')
    expect(text).not.toMatch(/at\s+\w+\s+\(/)
  })

  // Accessibility: a real button, reachable and operable by keyboard.
  it('offers the reload action as a keyboard-operable button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(
      <BootErrorBoundary>
        <Explodes />
      </BootErrorBoundary>,
    )

    const button = screen.getByRole('button', { name: RELOAD_LABEL })
    expect(button).toHaveAttribute('type', 'button')

    await user.tab()
    expect(button).toHaveFocus()
  })

  // 7. The recovery action really calls the browser's reload.
  it('reloads the document when the recovery action is used', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reload, restore } = stubReload()

    try {
      const user = userEvent.setup()
      render(
        <BootErrorBoundary>
          <Explodes />
        </BootErrorBoundary>,
      )

      await user.click(screen.getByRole('button', { name: RELOAD_LABEL }))

      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  // 6. Recovery must never destroy the user's data.
  it('does not clear or rewrite stored data when recovering', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { restore } = stubReload()

    // Something the user would miss if we erased it on the way out.
    window.localStorage.setItem('ascend:test-valuable', 'do not lose me')
    const before = window.localStorage.getItem('ascend:test-valuable')

    try {
      const user = userEvent.setup()
      render(
        <BootErrorBoundary>
          <Explodes />
        </BootErrorBoundary>,
      )

      await user.click(screen.getByRole('button', { name: RELOAD_LABEL }))

      expect(window.localStorage.getItem('ascend:test-valuable')).toBe(before)
      expect(window.localStorage.getItem('ascend:test-valuable')).toBe('do not lose me')
    } finally {
      restore()
      window.localStorage.clear()
    }
  })
})

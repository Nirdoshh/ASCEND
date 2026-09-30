import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  createPreferencesRepository,
  type Preferences,
  type PreferencesRepository,
  type ThemePreference,
} from '../data/repositories'
import { createWebStorageStore, type StoreWriteResult } from '../data/storage'

/**
 * The repository the app uses by default.
 *
 * This single line is the seam between "local-first" and "cloud".
 * In Phase 11 we replace the factory below with one that talks to the
 * Worker API. No component, hook or screen changes, because nothing
 * above this file knows what a repository is.
 */
export const defaultPreferencesRepository: PreferencesRepository = createPreferencesRepository(
  createWebStorageStore(),
)

interface PreferencesContextValue {
  preferences: Preferences
  theme: ThemePreference
  /** The theme actually rendered, after resolving "system". */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
  cycleTheme: () => void
  /** 'ok' when preferences persist; 'unavailable' when they cannot. */
  storageStatus: Extract<StoreWriteResult, 'ok' | 'unavailable'>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

export function PreferencesProvider({
  children,
  repository = defaultPreferencesRepository,
}: {
  children: ReactNode
  /** Injectable so tests can supply an in-memory repository. */
  repository?: PreferencesRepository
}) {
  const [preferences, setPreferences] = useState<Preferences>(() => repository.load())

  // Initialised from the repository, not guessed. Reading load() again
  // or inferring availability from the schema version would tell the
  // user their settings are saved when they may not be.
  const [storageStatus, setStorageStatus] = useState<
    Extract<StoreWriteResult, 'ok' | 'unavailable'>
  >(() => (repository.isAvailable() ? 'ok' : 'unavailable'))

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      setPreferences((current) => {
        const next: Preferences = { ...current, theme }
        setStorageStatus(repository.save(next) === 'ok' ? 'ok' : 'unavailable')
        return next
      })
    },
    [repository],
  )

  const cycleTheme = useCallback(() => {
    setPreferences((current) => {
      const next: Preferences = { ...current, theme: NEXT_THEME[current.theme] }
      setStorageStatus(repository.save(next) === 'ok' ? 'ok' : 'unavailable')
      return next
    })
  }, [repository])

  const resolvedTheme = useResolvedTheme(preferences.theme)

  // Apply the theme to the document. "system" removes the attribute so
  // the CSS media query in tokens.css takes over.
  useEffect(() => {
    const root = document.documentElement
    if (preferences.theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', preferences.theme)
    }
  }, [preferences.theme])

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, theme: preferences.theme, resolvedTheme, setTheme, cycleTheme, storageStatus }),
    [preferences, resolvedTheme, setTheme, cycleTheme, storageStatus],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>')
  }
  return context
}

function useResolvedTheme(theme: ThemePreference): 'light' | 'dark' {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? 'light'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light',
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    query.addEventListener('change', onChange)
    // Re-read once on mount: the OS theme can change between the
    // lazy initialiser and this effect running.
    onChange(query as unknown as MediaQueryListEvent)

    return () => query.removeEventListener('change', onChange)
  }, [])

  return theme === 'system' ? systemTheme : theme
}

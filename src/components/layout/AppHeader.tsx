import { usePreferences } from '../../app/PreferencesProvider'
import { Icon, type IconName } from '../ui/Icon'
import './AppHeader.css'

const THEME_SEQUENCE = ['system', 'light', 'dark'] as const
const THEME_LABEL: Record<(typeof THEME_SEQUENCE)[number], string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
}
const THEME_ICON: Record<(typeof THEME_SEQUENCE)[number], IconName> = {
  system: 'system',
  light: 'sun',
  dark: 'moon',
}

/**
 * The app header.
 *
 * Phase 1 keeps this deliberately quiet: the wordmark and one control.
 * The header is not a place for badges, streaks or notifications. On a
 * screen whose whole job is "what should I do right now?", anything
 * here that is not essential is an obstacle.
 */
export function AppHeader() {
  const { theme, resolvedTheme, cycleTheme } = usePreferences()

  // Index into the sequence to find the next preference. The `??`
  // satisfies noUncheckedIndexedAccess; it cannot trigger for a valid
  // theme because the sequence has no gaps.
  const nextTheme =
    THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(theme) + 1) % THEME_SEQUENCE.length] ?? 'system'

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <p className="app-header__wordmark">
          <span className="visually-hidden">ASCEND. </span>
          <span aria-hidden="true">ASCEND</span>
        </p>

        {/*
          A single cycling button rather than a three-way select.

          It is one thumb-reachable control instead of three, which
          matters more on a phone than a one-click jump between two
          specific themes. The accessible name always states the
          current value AND the action, so the behaviour is never a
          surprise:
            "Colour theme: Match my device. Switch to Light."
        */}
        <button
          type="button"
          className="app-header__theme"
          onClick={cycleTheme}
          aria-label={`Colour theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[nextTheme]}.`}
          title={`Colour theme: ${THEME_LABEL[theme]}`}
        >
          <Icon name={THEME_ICON[theme]} />
        </button>
      </div>

      {/* Colour is never the only signal: the chosen theme is also
          announced in text by the button's accessible name, and the
          icon changes shape (device / sun / moon), not just colour. */}
      <span className="visually-hidden" aria-live="polite">
        {`Current colour theme: ${THEME_LABEL[theme]}${
          theme === 'system' ? ` (your device is set to ${resolvedTheme})` : ''
        }`}
      </span>
    </header>
  )
}

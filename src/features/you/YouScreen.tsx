import { ScreenHeader } from '../../app/ScreenHeader'
import { usePreferences } from '../../app/PreferencesProvider'
import { Card } from '../../components/ui'
import './YouScreen.css'

const THEME_LABEL: Record<'system' | 'light' | 'dark', string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
}

/**
 * YOU — "What am I working toward and how should ASCEND work for me?"
 *
 * Reads saved preferences through the repository.
 * That makes the whole layering visible and testable in one place:
 *
 *   UI  ->  usePreferences()  ->  PreferencesRepository  ->  Web Storage
 *
 * The control itself lives in the header, because a preference you have
 * to hunt for is a preference nobody changes. Here we show its
 * current value.
 */
export function YouScreen() {
  const { preferences, resolvedTheme, storageStatus } = usePreferences()

  return (
    <>
      <ScreenHeader title="You">
        <p>A little space to make ASCEND feel comfortable.</p>
      </ScreenHeader>

      <div className="stack-lg">
        {/*
          Honest reporting: if preferences cannot be saved (private
          browsing, storage blocked, quota reached) we say so rather
          than silently pretending the setting took effect.
        */}
        {storageStatus === 'unavailable' ? (
          <Card tone="accent" title="Settings are not being saved">
            <p>
              Your browser is blocking local storage, so ASCEND cannot remember your
              preferences. You can still use the app — nothing is sent anywhere — but
              changes will reset when you close the tab.
            </p>
          </Card>
        ) : null}

        <Card title="Preferences">
          <dl className="preference-list">
            <div className="preference-list__row">
              <dt className="preference-list__term">Colour theme</dt>
              <dd className="preference-list__value">
                {THEME_LABEL[preferences.theme]}
                {preferences.theme === 'system' ? (
                  <span className="text-muted"> (your device is set to {resolvedTheme})</span>
                ) : null}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted preference-list__note">
            Use the theme control in the top right to switch between light, dark,
            and your device setting.
          </p>
        </Card>

      </div>
    </>
  )
}

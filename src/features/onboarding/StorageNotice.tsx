import { useOnboarding } from './OnboardingDraftProvider'
import './StorageNotice.css'

/**
 * The honest answer to "will my answers still be here tomorrow?"
 *
 * Rendered in ONE place, above the onboarding outlet, so every
 * onboarding screen tells the same truth. Silently dropping the user's
 * typing because storage is blocked would be the single worst
 * behaviour this app could have: they would answer four questions,
 * close the tab, and find nothing.
 *
 * Deliberately not styled as an error. Nothing has gone wrong — the app
 * works fine right now. It is the same tone as a save icon turning
 * grey, not a red banner.
 *
 * role="status" so it is announced when it appears, because someone who
 * cannot persist their work needs to know before they start typing,
 * not after.
 */
export function StorageNotice() {
  const { storageStatus, draft } = useOnboarding()

  if (storageStatus === 'ok') return null

  return (
    <p className="storage-notice" role="status">
      {draft
        ? 'Your answers are safe while this page is open, but this browser is not letting ASCEND save them. Do not close this tab yet.'
        : 'This browser is not letting ASCEND save anything. You can still look around, but your answers will disappear if you close the tab.'}
    </p>
  )
}
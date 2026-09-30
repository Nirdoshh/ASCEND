/**
 * Storage keys.
 *
 * Every key is namespaced and versioned in the key itself:
 *   ascend:<name>:v<schemaVersion>
 *
 * Why the version lives in the KEY and not only inside the value:
 *   A version inside the value cannot be read safely if the value is
 *   corrupt JSON. Putting the version in the key means the migration
 *   layer can identify which schema a blob belongs to without first
 *   trusting what is inside it.
 *
 * public/theme-init.js reads ASCEND_PREFERENCES_KEY. A test asserts the
 * two stay in sync, because a mismatch would silently break dark mode.
 */
export const ASCEND_PREFERENCES_KEY = 'ascend:preferences:v1'

/**
 * The onboarding draft.
 *
 * Separate key, separate version. Onboarding data is transient and
 * preferences are permanent, so they must be able to be deleted
 * independently: finishing onboarding clears this key without touching
 * the user's theme, and a corrupted draft can be discarded without
 * losing a setting.
 */
export const ASCEND_ONBOARDING_DRAFT_KEY = 'ascend:onboarding-draft:v1'

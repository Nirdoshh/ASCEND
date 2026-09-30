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

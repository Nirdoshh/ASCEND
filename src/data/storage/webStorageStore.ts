/**
 * A tiny, safe key/value store over Web Storage.
 *
 * Two rules this file exists to enforce:
 *
 *  1. NO REACT COMPONENT EVER CALLS localStorage.
 *     Persistence lives behind this interface so we can replace
 *     localStorage with a Cloudflare Worker + D1 API in Phase 11
 *     without touching a single component.
 *
 *  2. STORAGE IS NEVER ALLOWED TO CRASH THE APP.
 *     Web Storage can throw in more situations than people expect:
 *       - Safari private browsing historically threw on write
 *       - A user or enterprise policy can block storage entirely
 *       - The ~5 MB quota can be exceeded
 *       - Another tab can leave a half-written or corrupt value
 *     Every operation here is defensive and reports failure instead of
 *     propagating an exception.
 *
 * This layer knows nothing about ASCEND's data model. It stores and
 * returns `unknown`; interpreting that shape is the repository's job.
 */

export type StoreWriteResult = 'ok' | 'quota-exceeded' | 'unavailable'

export interface KeyValueStore {
  /** Returns the parsed value, or null if absent, unreadable or corrupt. */
  read(key: string): unknown | null
  write(key: string, value: unknown): StoreWriteResult
  remove(key: string): void
  isAvailable(): boolean
}

/** Reports whether Web Storage can be used at all in this environment. */
export function detectWebStorageAvailability(): boolean {
  try {
    const probe = '__ascend_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export function createWebStorageStore(
  storage: Storage | null = safeLocalStorage(),
): KeyValueStore {
  const available = storage !== null

  return {
    isAvailable: () => available,

    read(key: string): unknown | null {
      if (!storage) return null

      let raw: string | null
      try {
        raw = storage.getItem(key)
      } catch {
        // Storage became unavailable after the initial probe.
        return null
      }

      if (raw === null) return null

      try {
        return JSON.parse(raw) as unknown
      } catch {
        // Corrupt data is worse than no data: it can break the app on
        // every load. We drop it and continue with defaults, and we log
        // so the condition is visible in development.
        console.warn(`[ascend] discarded corrupt value for key "${key}"`)
        try {
          storage.removeItem(key)
        } catch {
          // Nothing more we can do; the read path already returns null.
        }
        return null
      }
    },

    write(key: string, value: unknown): StoreWriteResult {
      if (!storage) return 'unavailable'

      try {
        storage.setItem(key, JSON.stringify(value))
        return 'ok'
      } catch (error) {
        return isQuotaError(error) ? 'quota-exceeded' : 'unavailable'
      }
    },

    remove(key: string): void {
      if (!storage) return
      try {
        storage.removeItem(key)
      } catch {
        // Best effort. A failed delete cannot break the caller.
      }
    },
  }
}

/** Accessing localStorage can itself throw, so we never do it directly. */
function safeLocalStorage(): Storage | null {
  try {
    return detectWebStorageAvailability() ? window.localStorage : null
  } catch {
    return null
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  // Legacy browsers used a numeric code, modern ones a name.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  )
}

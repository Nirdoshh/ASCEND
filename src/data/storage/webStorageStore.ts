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

/** Explicit, non-destructive reads for historical aggregation. */
export type StoreReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: 'storage-unavailable' | 'invalid-data' }

export interface KeyValueStore {
  readResult(key: string): StoreReadResult<unknown | null>
  /** Only matching keys are returned; values are read separately. */
  keysWithPrefix(prefix: string): StoreReadResult<string[]>
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

    readResult(key) {
      if (!storage) return { ok: false, problem: 'storage-unavailable' }
      let raw: string | null
      try {
        raw = storage.getItem(key)
      } catch {
        return { ok: false, problem: 'storage-unavailable' }
      }
      if (raw === null) return { ok: true, value: null }
      try {
        const value: unknown = JSON.parse(raw)
        // JSON null is a stored malformed record, not an absent key.
        return value === null
          ? { ok: false, problem: 'invalid-data' }
          : { ok: true, value }
      } catch {
        // Preserve the original bytes for recovery by the user/newer builds.
        return { ok: false, problem: 'invalid-data' }
      }
    },

    keysWithPrefix(prefix) {
      if (!storage) return { ok: false, problem: 'storage-unavailable' }
      try {
        const keys: string[] = []
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index)
          if (key?.startsWith(prefix)) keys.push(key)
        }
        return { ok: true, value: keys }
      } catch {
        return { ok: false, problem: 'storage-unavailable' }
      }
    },

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
        // Do not expose malformed data to callers, but preserve its bytes.
        // A route guard can read before a consumer's explicit readResult;
        // removing it here would silently turn unreadable history into absence.
        //
        // This is one of the two places in ASCEND that writes to the
        // console. It is deliberate and local: `no-console` is on
        // everywhere else so that accidental logging is still visible.
        // eslint-disable-next-line no-console
        console.warn(`[ascend] could not read value for key "${key}"; original data preserved`)
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

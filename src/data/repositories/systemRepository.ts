import { hasNewerSystemSchema, migrateSystemData, normalizeSystemData, type SystemData } from '../../domain/systemPathGoal'
import { ASCEND_SYSTEM_KEY } from '../storage/keys'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'
import type { RepositoryReadResult } from './readResult'

export type SystemRepositoryWriteResult = StoreWriteResult | 'newer-schema' | 'invalid-data'

export interface SystemRepository {
  read(): RepositoryReadResult<SystemData | null>
  load(): SystemData | null
  save(data: SystemData): SystemRepositoryWriteResult
  isAvailable(): boolean
}

export function createSystemRepository(store: KeyValueStore): SystemRepository {
  return {
    read() {
      const raw = store.readResult(ASCEND_SYSTEM_KEY)
      if (!raw.ok) return raw
      if (raw.value === null) return { ok: true, value: null }
      if (hasNewerSystemSchema(raw.value)) return { ok: false, problem: 'newer-schema' }
      const data = migrateSystemData(raw.value)
      return data ? { ok: true, value: data } : { ok: false, problem: 'invalid-data' }
    },

    load() {
      const result = this.read()
      return result.ok ? result.value : null
    },

    save(data) {
      if (!normalizeSystemData(data)) return 'invalid-data'
      const current = store.readResult(ASCEND_SYSTEM_KEY)
      if (!current.ok) return current.problem === 'invalid-data' ? 'invalid-data' : 'unavailable'
      if (current.value !== null) {
        if (hasNewerSystemSchema(current.value)) return 'newer-schema'
        if (!migrateSystemData(current.value)) return 'invalid-data'
      }
      return store.write(ASCEND_SYSTEM_KEY, data)
    },

    isAvailable: () => store.isAvailable(),
  }
}

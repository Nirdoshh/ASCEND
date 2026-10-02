import {
  changeGoalStatus,
  changePathStatus,
  createGoal,
  createPath,
  createSystemData,
  createSuggestedSystemData,
  updateGoal,
  updatePath,
  type GoalStatus,
  type PathStatus,
  type SystemData,
} from '../domain/systemPathGoal'
import type { SystemRepository, SystemRepositoryWriteResult } from '../data/repositories/systemRepository'
import type { RepositoryReadResult } from '../data/repositories/readResult'

export type SystemOperationResult =
  | { readonly ok: true; readonly data: SystemData }
  | { readonly ok: false; readonly problem: 'storage-unavailable' | 'quota-exceeded' | 'newer-schema' | 'invalid-data' | 'not-found' | 'invalid-parent' | 'invalid-input' }
type SystemProblem = 'storage-unavailable' | 'quota-exceeded' | 'newer-schema' | 'invalid-data' | 'not-found' | 'invalid-parent' | 'invalid-input'

export interface SystemApplicationService {
  load(): RepositoryReadResult<SystemData | null>
  seedIfAbsent(now: string): SystemOperationResult
  createPath(input: { name: string; description?: string; source?: 'SUGGESTED' | 'CUSTOM'; now: string; id?: string }): SystemOperationResult
  updatePath(id: string, input: { name: string; description?: string; now: string }): SystemOperationResult
  setPathStatus(id: string, status: PathStatus, now: string): SystemOperationResult
  createGoal(input: { pathId: string; title: string; description?: string; why?: string; now: string; id?: string }): SystemOperationResult
  updateGoal(id: string, input: { title: string; description?: string; why?: string; now: string }): SystemOperationResult
  setGoalStatus(id: string, status: GoalStatus, now: string): SystemOperationResult
}

function write(repository: SystemRepository, data: SystemData): SystemOperationResult {
  const result: SystemRepositoryWriteResult = repository.save(data)
  if (result === 'ok') return { ok: true, data }
  return { ok: false, problem: result === 'unavailable' ? 'storage-unavailable' : result }
}

function readData(repository: SystemRepository): { readonly ok: true; readonly data: SystemData } | { readonly ok: false; readonly problem: SystemProblem } {
  const result = repository.read()
  if (!result.ok) return { ok: false, problem: result.problem }
  return { ok: true, data: result.value ?? createSystemData() }
}

export function createSystemApplicationService(repository: SystemRepository): SystemApplicationService {
  return {
    load: () => repository.read(),

    seedIfAbsent(now) {
      const result = repository.read()
      if (!result.ok) return { ok: false, problem: result.problem }
      if (result.value) return { ok: true, data: result.value }
      return write(repository, createSuggestedSystemData(now))
    },

    createPath(input) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      try {
        const path = createPath(input)
        if (current.paths.some((entry) => entry.id === path.id)) return { ok: false, problem: 'invalid-data' }
        return write(repository, createSystemData([...current.paths, path], current.goals))
      } catch { return { ok: false, problem: 'invalid-input' } }
    },

    updatePath(id, input) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      const path = current.paths.find((entry) => entry.id === id)
      if (!path) return { ok: false, problem: 'not-found' }
      try { return write(repository, createSystemData(current.paths.map((entry) => entry.id === id ? updatePath(path, input) : entry), current.goals)) } catch { return { ok: false, problem: 'invalid-input' } }
    },

    setPathStatus(id, status, now) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      const path = current.paths.find((entry) => entry.id === id)
      return path ? write(repository, createSystemData(current.paths.map((entry) => entry.id === id ? changePathStatus(entry, status, now) : entry), current.goals)) : { ok: false, problem: 'not-found' }
    },

    createGoal(input) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      if (!current.paths.some((path) => path.id === input.pathId)) return { ok: false, problem: 'invalid-parent' }
      try {
        const goal = createGoal(input)
        if (current.goals.some((entry) => entry.id === goal.id)) return { ok: false, problem: 'invalid-data' }
        return write(repository, createSystemData(current.paths, [...current.goals, goal]))
      } catch { return { ok: false, problem: 'invalid-input' } }
    },

    updateGoal(id, input) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      const goal = current.goals.find((entry) => entry.id === id)
      if (!goal) return { ok: false, problem: 'not-found' }
      try { return write(repository, createSystemData(current.paths, current.goals.map((entry) => entry.id === id ? updateGoal(goal, input) : entry))) } catch { return { ok: false, problem: 'invalid-input' } }
    },

    setGoalStatus(id, status, now) {
      const currentResult = readData(repository)
      if (!currentResult.ok) return currentResult
      const current = currentResult.data
      const goal = current.goals.find((entry) => entry.id === id)
      return goal ? write(repository, createSystemData(current.paths, current.goals.map((entry) => entry.id === id ? changeGoalStatus(entry, status, now) : entry))) : { ok: false, problem: 'not-found' }
    },
  }
}

import { describe, expect, it } from 'vitest'

import { changeGoalStatus, createGoal, createPath, createSuggestedSystemData, normalizeSystemData, SYSTEM_SCHEMA_VERSION, updateGoal } from './systemPathGoal'

const NOW = '2026-10-02T12:00:00.000Z'

describe('System Path and Goal domain', () => {
  it('creates four suggested Paths with stable opaque ids', () => {
    const data = createSuggestedSystemData(NOW)
    expect(data.schemaVersion).toBe(SYSTEM_SCHEMA_VERSION)
    expect(data.paths.map((path) => path.name)).toEqual(['BODY', 'MIND', 'FOCUS', 'SELF'])
    expect(data.paths.every((path) => path.id.startsWith('path_'))).toBe(true)
  })

  it('keeps identity and history stable through edits and completion', () => {
    const path = createPath({ id: 'path_custom', name: 'Mind', now: NOW })
    const goal = createGoal({ id: 'goal_custom', pathId: path.id, title: 'Learn JavaScript', now: NOW })
    const edited = updateGoal(goal, { title: 'Learn TypeScript', why: 'Build with confidence', now: '2026-10-03T12:00:00.000Z' })
    const completed = changeGoalStatus(edited, 'COMPLETED', '2026-10-04T12:00:00.000Z')
    expect(edited.id).toBe(goal.id)
    expect(edited.pathId).toBe(path.id)
    expect(edited.createdAt).toBe(NOW)
    expect(completed.completedAt).toBe('2026-10-04T12:00:00.000Z')
  })

  it('rejects duplicate ids, missing parents, malformed records, and future data', () => {
    const path = createPath({ id: 'path_one', name: 'BODY', now: NOW })
    const goal = createGoal({ id: 'goal_one', pathId: path.id, title: 'Run 5K', now: NOW })
    expect(normalizeSystemData({ schemaVersion: 1, paths: [path, path], goals: [] })).toBeNull()
    expect(normalizeSystemData({ schemaVersion: 1, paths: [path], goals: [{ ...goal, pathId: 'path_missing' }] })).toBeNull()
    expect(normalizeSystemData({ schemaVersion: 99, paths: [], goals: [] })).toBeNull()
  })
})

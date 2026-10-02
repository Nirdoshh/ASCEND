import { describe, expect, it } from 'vitest'

import { createSuggestedSystemData } from '../domain/systemPathGoal'
import { createSystemApplicationService } from './systemPaths'
import { createSystemRepository } from '../data/repositories/systemRepository'
import { createWebStorageStore } from '../data/storage/webStorageStore'

const NOW = '2026-10-02T12:00:00.000Z'

describe('System application service', () => {
  it('creates, edits, pauses, resumes, completes, and archives a Goal', () => {
    const service = createSystemApplicationService(createSystemRepository(createWebStorageStore()))
    const path = createSuggestedSystemData(NOW).paths[1]!
    expect(service.createPath({ name: path.name, now: NOW, id: path.id })).toEqual({ ok: true, data: expect.anything() })
    const created = service.createGoal({ pathId: path.id, title: 'Learn JavaScript', now: NOW, id: 'goal_test' })
    expect(created.ok).toBe(true)
    expect(service.updateGoal('goal_test', { title: 'Learn TypeScript', now: NOW }).ok).toBe(true)
    expect(service.setGoalStatus('goal_test', 'PAUSED', NOW).ok).toBe(true)
    expect(service.setGoalStatus('goal_test', 'ACTIVE', NOW).ok).toBe(true)
    const completed = service.setGoalStatus('goal_test', 'COMPLETED', '2026-10-03T12:00:00.000Z')
    expect(completed.ok && completed.data.goals[0]?.completedAt).toBe('2026-10-03T12:00:00.000Z')
    expect(service.setGoalStatus('goal_test', 'ARCHIVED', NOW).ok).toBe(true)
  })

  it('rejects a Goal whose parent Path is missing', () => {
    const service = createSystemApplicationService(createSystemRepository(createWebStorageStore()))
    expect(service.createGoal({ pathId: 'path_missing', title: 'No parent', now: NOW })).toEqual({ ok: false, problem: 'invalid-parent' })
  })
})

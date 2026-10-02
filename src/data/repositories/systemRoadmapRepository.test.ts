import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSystemRepository } from './systemRepository'
import { createWebStorageStore } from '../storage/webStorageStore'
import { ASCEND_SYSTEM_KEY } from '../storage/keys'
import { createGoal, createSuggestedSystemData } from '../../domain/systemPathGoal'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../../test/systemRoadmapFixtures'

beforeEach(() => window.localStorage.clear())
describe('System v2 persistence and migration', () => {
  it('round trips Roadmaps, Phases, Steps and selection', () => {
    const data = roadmapFixture()
    const selected = { ...data, roadmaps: data.roadmaps.map(r => ({ ...r, activeStepId: 'step_one' })) }
    expect(createSystemRepository(createWebStorageStore()).save(selected)).toBe('ok')
    expect(createSystemRepository(createWebStorageStore()).load()).toEqual(selected)
  })
  it('migrates Beta 1 in memory without altering records, ids, statuses, timestamps, authored content or stored bytes', () => {
    const initial = createSuggestedSystemData(NOW)
    const paths = initial.paths.map(p => ({ ...p, status: 'PAUSED' as const, description: '  Original user text 🧭  ' }))
    const goal = { ...createGoal({ id: 'goal_original', pathId: paths[0]!.id, title: 'Run 5K', description: 'A personal route', why: 'For me', now: NOW }), status: 'COMPLETED' as const, completedAt: NOW }
    const legacy = { schemaVersion: 1, paths, goals: [goal], recoverableExtension: 'Keep this' }
    const bytes = JSON.stringify(legacy)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    const migrated = repository.load()!
    expect(migrated).toEqual({
  ...legacy,
  schemaVersion: 3,
  roadmaps: [],
  roadmapPhases: [],
  roadmapSteps: [],
  directives: [],
  directiveObjectives: [],
})
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
    expect(repository.save(migrated)).toBe('ok')
    expect(repository.load()?.paths).toEqual(paths)
    expect(repository.load()?.goals).toEqual([goal])
    // The exact guard shipped in Beta 1 refuses the resulting version.
    expect(JSON.parse(window.localStorage.getItem(ASCEND_SYSTEM_KEY)!).schemaVersion).toBeGreaterThan(1)
  })
  it.each(['collection', 'path', 'goal', 'roadmap', 'phase', 'step'])('protects future %s schemas on read and every write', kind => {
    const data = roadmapFixture()
    const future = structuredClone(data)
    if (kind === 'collection') Object.assign(future, { schemaVersion: 99 })
    else {
      const record = kind === 'path' ? future.paths[0] : kind === 'goal' ? future.goals[0] : kind === 'roadmap' ? future.roadmaps[0] : kind === 'phase' ? future.roadmapPhases[0] : future.roadmapSteps[0]
      Object.assign(record!, { schemaVersion: 99 })
    }
    const bytes = JSON.stringify(future)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.read()).toEqual({ ok: false, problem: 'newer-schema' })
    expect(repository.save(data)).toBe('newer-schema')
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })
  it.each(['duplicate', 'orphan-roadmap', 'orphan-phase', 'orphan-step', 'invalid-prerequisite', 'self', 'cycle', 'wrong-type', 'bad-order', 'bad-optional', 'bad-time', 'active-locked', 'two-roadmaps', 'missing-collections'])('refuses malformed %s without destructive overwrite', kind => {
    const raw = structuredClone(roadmapFixture())
    switch (kind) {
      case 'duplicate': Object.assign(raw.roadmapSteps[0]!, { id: raw.roadmapPhases[0]!.id }); break
      case 'orphan-roadmap': Object.assign(raw.roadmaps[0]!, { goalId: 'missing' }); break
      case 'orphan-phase': Object.assign(raw.roadmapPhases[0]!, { roadmapId: 'missing' }); break
      case 'orphan-step': Object.assign(raw.roadmapSteps[0]!, { phaseId: 'missing' }); break
      case 'invalid-prerequisite': Object.assign(raw.roadmapSteps[0]!, { prerequisiteStepIds: ['missing'] }); break
      case 'self': Object.assign(raw.roadmapSteps[0]!, { prerequisiteStepIds: ['step_one'] }); break
      case 'cycle': Object.assign(raw.roadmapSteps[0]!, { prerequisiteStepIds: ['step_two'] }); break
      case 'wrong-type': Object.assign(raw.roadmaps[0]!, { type: 'OTHER' }); break
      case 'bad-order': Object.assign(raw.roadmapSteps[1]!, { order: -1 }); break
      case 'bad-optional': Object.assign(raw.roadmapSteps[0]!, { optional: 'yes' }); break
      case 'bad-time': Object.assign(raw.roadmapSteps[0]!, { completedAt: 'yesterday' }); break
      case 'active-locked': Object.assign(raw.roadmaps[0]!, { activeStepId: 'step_two' }); break
      case 'two-roadmaps': Object.assign(raw, { roadmaps: [...raw.roadmaps, { ...raw.roadmaps[0], id: 'another' }] }); break
      case 'missing-collections': Reflect.deleteProperty(raw, 'roadmapSteps'); break
    }
    const bytes = JSON.stringify(raw)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.read()).toEqual({ ok: false, problem: 'invalid-data' })
    expect(repository.save(roadmapFixture())).toBe('invalid-data')
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })
  it('rejects malformed v1 and conflicting unversioned extensions', () => {
    const repository = createSystemRepository(createWebStorageStore())
    for (const raw of [{ schemaVersion: 1, paths: [{}], goals: [] }, { schemaVersion: 1, paths: [], goals: [], roadmaps: [{ title: 'Do not lose' }] }]) {
      const bytes = JSON.stringify(raw)
      window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
      expect(repository.read().ok).toBe(false)
      expect(repository.save(roadmapFixture())).toBe('invalid-data')
      expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
    }
  })
  it.each(['quota-exceeded', 'unavailable'] as const)('preserves prior bytes on %s writes', failure => {
    const store = createWebStorageStore()
    const repository = createSystemRepository(store)
    const data = roadmapFixture()
    expect(repository.save(data)).toBe('ok')
    const bytes = window.localStorage.getItem(ASCEND_SYSTEM_KEY)
    vi.spyOn(store, 'write').mockReturnValue(failure)
    expect(repository.save({ ...data, roadmaps: data.roadmaps.map(r => ({ ...r, title: 'New' })) })).toBe(failure)
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })
})

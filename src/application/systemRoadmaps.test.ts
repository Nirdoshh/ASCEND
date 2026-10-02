import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSystemRoadmapService } from './systemRoadmaps'
import { createSystemApplicationService } from './systemPaths'
import { createSystemRepository } from '../data/repositories/systemRepository'
import { createWebStorageStore } from '../data/storage/webStorageStore'
import { ASCEND_SYSTEM_KEY } from '../data/storage/keys'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../test/systemRoadmapFixtures'
beforeEach(() => window.localStorage.clear())
function setup() {
  const store = createWebStorageStore(), repository = createSystemRepository(store)
  repository.save(roadmapFixture())
  return { store, repository, service: createSystemRoadmapService(repository) }
}
describe('System Roadmap application services', () => {
  it('creates and edits a route directly from an existing Goal', () => {
    const { repository, service } = setup()
    const initial = repository.load()!
    repository.save({ ...initial, roadmaps: [], roadmapPhases: [], roadmapSteps: [] })
    expect(service.create('goal_test', 'GOAL', { title: 'My route', description: 'Written by me' }, NOW).ok).toBe(true)
    const id = repository.load()!.roadmaps[0]!.id
    expect(service.edit(id, { title: 'Updated route' }, NOW).ok).toBe(true)
    expect(repository.load()!.roadmaps[0]).toMatchObject({ id, title: 'Updated route', createdAt: NOW })
    expect(service.create('goal_test', 'SKILL', { title: 'Duplicate' }, NOW).ok).toBe(false)
  })
  it('manages Phases and Steps through bounded operations', () => {
    const { repository, service } = setup()
    expect(service.addPhase('roadmap_test', { title: 'Projects' }, NOW).ok).toBe(true)
    const phaseId = repository.load()!.roadmapPhases.at(-1)!.id
    expect(service.editPhase(phaseId, { title: 'Build' }, NOW).ok).toBe(true)
    expect(service.addStep(phaseId, { title: 'App', optional: true }, NOW).ok).toBe(true)
    const stepId = repository.load()!.roadmapSteps.at(-1)!.id
    expect(service.editStep(stepId, { title: 'Ship App' }, NOW).ok).toBe(true)
    expect(service.setOptional(stepId, false, NOW).ok).toBe(true)
    expect(service.setPrerequisites(stepId, ['step_two'], NOW).ok).toBe(true)
    expect(service.setPrerequisites(stepId, [], NOW).ok).toBe(true)
    expect(service.reorderPhases('roadmap_test', [phaseId, 'phase_one', 'phase_two'], NOW).ok).toBe(true)
    expect(service.reorderSteps('phase_two', ['step_three', 'step_two'], NOW).ok).toBe(true)
    expect(service.archiveStep(stepId, NOW).ok).toBe(true)
    expect(service.restoreStep(stepId, NOW).ok).toBe(true)
    expect(service.archivePhase(phaseId, NOW).ok).toBe(true)
    expect(service.restorePhase(phaseId, NOW).ok).toBe(true)
  })
  it('serves current selection and derived next suggestion without UI dependencies', () => {
    const { service, repository } = setup()
    expect(service.setActive('roadmap_test', 'step_one', NOW).ok).toBe(true)
    expect(service.getCurrentStep('goal_test')).toMatchObject({ ok: true, value: { selected: true, step: { id: 'step_one' } } })
    expect(service.complete('step_one', NOW).ok).toBe(true)
    expect(service.getCurrentStep('goal_test')).toMatchObject({ ok: true, value: { selected: false, step: { id: 'step_two' } } })
    expect(repository.load()!.roadmaps[0]?.activeStepId).toBeNull()
    expect(service.undoComplete('step_one', NOW).ok).toBe(true)
  })
  it('pauses, resumes, archives and restores without losing content', () => {
    const { service, repository } = setup()
    expect(service.pause('roadmap_test', NOW).ok).toBe(true)
    expect(service.complete('step_one', NOW).ok).toBe(false)
    expect(service.resume('roadmap_test', NOW).ok).toBe(true)
    expect(service.archive('roadmap_test', NOW).ok).toBe(true)
    expect(repository.load()!.roadmapSteps).toHaveLength(3)
    expect(service.addPhase('roadmap_test', { title: 'Blocked' }, NOW).ok).toBe(false)
    expect(service.resume('roadmap_test', NOW).ok).toBe(true)
  })
  it('Beta 1 Path and Goal updates preserve Beta 2 Roadmap records', () => {
    const { repository } = setup()
    const before = repository.load()!
    const service = createSystemApplicationService(repository)
    service.updateGoal('goal_test', { title: 'TypeScript', now: NOW })
    service.setGoalStatus('goal_test', 'PAUSED', NOW)
    service.updatePath(before.paths[1]!.id, { name: 'Learning', now: NOW })
    service.setPathStatus(before.paths[1]!.id, 'PAUSED', NOW)
    service.createPath({ name: 'Custom', now: NOW })
    service.createGoal({ pathId: before.paths[1]!.id, title: 'Another Goal', now: NOW })
    expect(repository.load()).toMatchObject({ roadmaps: before.roadmaps, roadmapPhases: before.roadmapPhases, roadmapSteps: before.roadmapSteps })
  })
  it('rejects invalid dependencies without any partial text write', () => {
    const { service, repository } = setup()
    const before = repository.load()
    expect(service.execute({ kind: 'edit-step', stepId: 'step_one', title: 'Changed', prerequisiteStepIds: ['step_two'] }, NOW).ok).toBe(false)
    expect(repository.load()).toEqual(before)
  })
  it('rechecks future-schema data introduced after load before writing', () => {
    const { service } = setup()
    const bytes = JSON.stringify({ ...roadmapFixture(), schemaVersion: 99 })
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    expect(service.edit('roadmap_test', { title: 'Old tab' }, NOW)).toMatchObject({ ok: false, problem: 'newer-schema' })
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })
  it('returns a useful storage failure while keeping the last saved route', () => {
    const { store, service, repository } = setup()
    const before = repository.load()
    vi.spyOn(store, 'write').mockReturnValue('quota-exceeded')
    expect(service.edit('roadmap_test', { title: 'Unsaved' }, NOW)).toMatchObject({ ok: false, problem: 'quota-exceeded', message: expect.stringContaining('form') })
    expect(repository.load()).toEqual(before)
  })
})

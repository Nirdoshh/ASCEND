import { describe, expect, it } from 'vitest'
import { normalizeSystemData } from './systemPathGoal'
import { applyRoadmapCommand, currentRoadmapStep, orderedPhases, orderedSteps, roadmapProgress, stepState, type RoadmapCommand } from './systemRoadmap'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../test/systemRoadmapFixtures'

describe('Goal-owned Roadmap domain', () => {
  it.each(['SKILL', 'GOAL'] as const)('creates a valid %s route linked to a real Goal', type => {
    const data = roadmapFixture(type)
    expect(normalizeSystemData(data)).toEqual(data)
    expect(data.roadmaps[0]).toMatchObject({ goalId: 'goal_test', type, schemaVersion: 2 })
  })
  it('keeps ordering independent of title and id', () => {
    let data = roadmapFixture()
    data = applyRoadmapCommand(data, { kind: 'reorder-phases', roadmapId: 'roadmap_test', ids: ['phase_two', 'phase_one'] }, NOW)
    data = applyRoadmapCommand(data, { kind: 'reorder-steps', phaseId: 'phase_two', ids: ['step_three', 'step_two'] }, NOW)
    expect(orderedPhases(data, 'roadmap_test').map(p => p.id)).toEqual(['phase_two', 'phase_one'])
    expect(orderedSteps(data, 'roadmap_test').map(s => s.id)).toEqual(['step_three', 'step_two', 'step_one'])
  })
  it('derives locked, available, active and completed states', () => {
    let data = roadmapFixture()
    const state = (id: string) => stepState(data, data.roadmaps[0]!, data.roadmapSteps.find(s => s.id === id)!)
    expect(state('step_one')).toBe('AVAILABLE'); expect(state('step_two')).toBe('LOCKED')
    data = applyRoadmapCommand(data, { kind: 'active', roadmapId: 'roadmap_test', stepId: 'step_one' }, NOW)
    expect(state('step_one')).toBe('ACTIVE')
    data = applyRoadmapCommand(data, { kind: 'complete', stepId: 'step_one' }, NOW)
    expect(state('step_one')).toBe('COMPLETED'); expect(state('step_two')).toBe('AVAILABLE')
    expect(data.roadmaps[0]?.activeStepId).toBeNull()
    expect(currentRoadmapStep(data, data.roadmaps[0]!)?.selected).toBe(false)
    data = applyRoadmapCommand(data, { kind: 'undo', stepId: 'step_one' }, NOW)
    expect(state('step_one')).toBe('AVAILABLE'); expect(state('step_two')).toBe('LOCKED')
  })
  it('does not replace a user-selected Step after reordering or unrelated completion', () => {
    let data = roadmapFixture()
    data = applyRoadmapCommand(data, { kind: 'active', roadmapId: 'roadmap_test', stepId: 'step_three' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'complete', stepId: 'step_one' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'reorder-phases', roadmapId: 'roadmap_test', ids: ['phase_two', 'phase_one'] }, NOW)
    expect(currentRoadmapStep(data, data.roadmaps[0]!)).toMatchObject({ selected: true, step: { id: 'step_three' } })
  })
  it('optional is independent of completion and excluded from required progress', () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'optional', stepId: 'step_three', optional: true }, NOW)
    data = applyRoadmapCommand(data, { kind: 'complete', stepId: 'step_three' }, NOW)
    expect(stepState(data, data.roadmaps[0]!, data.roadmapSteps[2]!)).toBe('COMPLETED')
    expect(roadmapProgress(data, 'roadmap_test')).toEqual({ completed: 1, total: 3, required: 2, requiredCompleted: 0 })
  })
  it('completes and reopens a route from factual required completion', () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'optional', stepId: 'step_three', optional: true }, NOW)
    for (const stepId of ['step_one', 'step_two']) data = applyRoadmapCommand(data, { kind: 'complete', stepId }, NOW)
    expect(data.roadmaps[0]?.status).toBe('COMPLETED')
    data = applyRoadmapCommand(data, { kind: 'undo', stepId: 'step_two' }, NOW)
    expect(data.roadmaps[0]?.status).toBe('ACTIVE')
  })
  it('retains completed history during archive and restores identity', () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'complete', stepId: 'step_three' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'archive-step', stepId: 'step_three' }, NOW)
    expect(data.roadmapSteps[2]).toMatchObject({ id: 'step_three', completedAt: NOW, archivedAt: NOW, createdAt: NOW })
    data = applyRoadmapCommand(data, { kind: 'restore-step', stepId: 'step_three' }, NOW)
    expect(data.roadmapSteps[2]?.completedAt).toBe(NOW)
  })
  it('archiving a Phase hides children without deleting them', () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'archive-phase', phaseId: 'phase_two' }, NOW)
    expect(data.roadmapSteps).toHaveLength(3)
    expect(orderedSteps(data, 'roadmap_test')).toHaveLength(1)
    data = applyRoadmapCommand(data, { kind: 'restore-phase', phaseId: 'phase_two' }, NOW)
    expect(orderedSteps(data, 'roadmap_test')).toHaveLength(3)
  })
  it.each([
    { kind: 'prerequisites', stepId: 'step_one', ids: ['step_one'] },
    { kind: 'prerequisites', stepId: 'step_one', ids: ['missing'] },
    { kind: 'prerequisites', stepId: 'step_one', ids: ['step_two'] },
    { kind: 'prerequisites', stepId: 'step_two', ids: ['step_one', 'step_one'] },
    { kind: 'active', roadmapId: 'roadmap_test', stepId: 'step_two' },
    { kind: 'complete', stepId: 'step_two' },
    { kind: 'archive-step', stepId: 'step_one' },
    { kind: 'archive-phase', phaseId: 'phase_one' },
    { kind: 'create', goalId: 'goal_test', type: 'SKILL', title: 'Second route' },
    { kind: 'create', goalId: 'missing', type: 'SKILL', title: 'Orphan' },
    { kind: 'add-phase', roadmapId: 'roadmap_test', id: 'step_one', title: 'Collision' },
    { kind: 'reorder-phases', roadmapId: 'roadmap_test', ids: ['phase_one', 'phase_one'] },
    { kind: 'reorder-steps', phaseId: 'phase_two', ids: ['step_three'] },
    { kind: 'edit', roadmapId: 'roadmap_test', title: '' },
  ] satisfies RoadmapCommand[])('rejects unsafe edit %#', command => {
    const data = roadmapFixture()
    const original = structuredClone(data)
    expect(() => applyRoadmapCommand(data, command, NOW)).toThrow()
    expect(data).toEqual(original)
  })
  it('rejects longer prerequisite cycles', () => {
    const data = applyRoadmapCommand(roadmapFixture(), { kind: 'prerequisites', stepId: 'step_three', ids: ['step_two'] }, NOW)
    expect(() => applyRoadmapCommand(data, { kind: 'prerequisites', stepId: 'step_one', ids: ['step_three'] }, NOW)).toThrow()
  })
  it('protects completed dependents and active choice during undo', () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'complete', stepId: 'step_one' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'active', roadmapId: 'roadmap_test', stepId: 'step_two' }, NOW)
    expect(() => applyRoadmapCommand(data, { kind: 'undo', stepId: 'step_one' }, NOW)).toThrow()
    data = applyRoadmapCommand(data, { kind: 'complete', stepId: 'step_two' }, NOW)
    expect(() => applyRoadmapCommand(data, { kind: 'undo', stepId: 'step_one' }, NOW)).toThrow()
  })
  it('allows explicit optional prerequisites but requires their completion', () => {
    const data = applyRoadmapCommand(roadmapFixture(), { kind: 'optional', stepId: 'step_one', optional: true }, NOW)
    expect(stepState(data, data.roadmaps[0]!, data.roadmapSteps[1]!)).toBe('LOCKED')
  })
  it('GOAL routes do not accept prerequisites', () => {
    expect(() => applyRoadmapCommand(roadmapFixture('GOAL'), { kind: 'prerequisites', stepId: 'step_two', ids: ['step_one'] }, NOW)).toThrow()
  })
  it('paused and archived routes have no actionable current Step', () => {
    for (const status of ['PAUSED', 'ARCHIVED'] as const) {
      const data = applyRoadmapCommand(roadmapFixture(), { kind: 'status', roadmapId: 'roadmap_test', status }, NOW)
      expect(currentRoadmapStep(data, data.roadmaps[0]!)).toBeNull()
      expect(() => applyRoadmapCommand(data, { kind: 'complete', stepId: 'step_one' }, NOW)).toThrow()
    }
  })
})

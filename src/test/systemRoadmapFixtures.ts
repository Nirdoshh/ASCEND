import { createGoal, createSuggestedSystemData, type SystemData } from '../domain/systemPathGoal'
import { applyRoadmapCommand, type RoadmapType } from '../domain/systemRoadmap'

export const SYSTEM_TEST_NOW = '2026-10-02T12:00:00.000Z'
export function roadmapFixture(type: RoadmapType = 'SKILL'): SystemData {
  const data = createSuggestedSystemData(SYSTEM_TEST_NOW)
  let next: SystemData = { ...data, goals: [createGoal({ id: 'goal_test', pathId: data.paths[1]!.id, title: 'Learn JavaScript', description: 'My route', why: 'Build something real', now: SYSTEM_TEST_NOW })] }
  next = applyRoadmapCommand(next, { kind: 'create', id: 'roadmap_test', goalId: 'goal_test', type, title: 'JavaScript' }, SYSTEM_TEST_NOW)
  for (const [id, title] of [['phase_one', 'Foundation'], ['phase_two', 'Browser']] as const) next = applyRoadmapCommand(next, { kind: 'add-phase', roadmapId: 'roadmap_test', id, title }, SYSTEM_TEST_NOW)
  for (const [id, phaseId, title] of [['step_one', 'phase_one', 'Variables'], ['step_two', 'phase_two', 'DOM'], ['step_three', 'phase_two', 'Events']] as const) next = applyRoadmapCommand(next, { kind: 'add-step', id, phaseId, title }, SYSTEM_TEST_NOW)
  if (type === 'SKILL') next = applyRoadmapCommand(next, { kind: 'prerequisites', stepId: 'step_two', ids: ['step_one'] }, SYSTEM_TEST_NOW)
  return next
}

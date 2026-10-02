import { describe, expect, it } from 'vitest'

import { applyRoadmapCommand } from './systemRoadmap'
import { createGoal, createSuggestedSystemData, type SystemData } from './systemPathGoal'
import { createDailyDirective, deriveDirectiveCandidates, localDateKey } from './systemDailyDirective'

const NOW = '2026-10-02T12:00:00.000Z'

function route(): SystemData {
  const base = createSuggestedSystemData(NOW)
  let data: SystemData = { ...base, goals: [createGoal({ id: 'goal_1', pathId: base.paths[1]!.id, title: 'Learn JavaScript', now: NOW })] }
  data = applyRoadmapCommand(data, { kind: 'create', id: 'roadmap_1', goalId: 'goal_1', type: 'SKILL', title: 'Browser Programming' }, NOW)
  data = applyRoadmapCommand(data, { kind: 'add-phase', id: 'phase_1', roadmapId: 'roadmap_1', title: 'DOM' }, NOW)
  return applyRoadmapCommand(data, { kind: 'add-step', id: 'step_1', phaseId: 'phase_1', title: 'DOM Events' }, NOW)
}

describe('System Daily Directive domain', () => {
  it('uses local calendar fields for date identity', () => {
    expect(localDateKey(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02')
  })

  it('derives an explicit current step before available steps', () => {
    const data = route()
    const roadmap = data.roadmaps[0]!
    const selected = applyRoadmapCommand(data, { kind: 'active', roadmapId: roadmap.id, stepId: 'step_1' }, NOW)
    expect(deriveDirectiveCandidates(selected)[0]?.step.id).toBe('step_1')
    expect(deriveDirectiveCandidates(selected)[0]?.selected).toBe(true)
  })

  it('keeps directive text independent from a later Roadmap edit', () => {
    const directive = createDailyDirective({ dateKey: '2026-10-02', title: 'DOM Events', sourceType: 'ROADMAP_STEP', sourceRoadmapStepId: 'step_1', now: NOW })
    expect(directive.title).toBe('DOM Events')
    expect({ ...directive, title: 'Edited daily copy' }.title).toBe('Edited daily copy')
    expect(directive.sourceRoadmapStepId).toBe('step_1')
  })
})

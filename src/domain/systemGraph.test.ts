import { describe, expect, it } from 'vitest'
import { layoutSystemGraph, searchSystemGraph } from './systemGraph'
import { roadmapFixture } from '../test/systemRoadmapFixtures'

describe('system graph projection', () => {
  it('projects stable IDs and structural hierarchy at semantic levels', () => {
    const data = roadmapFixture()
    const global = layoutSystemGraph(data)
    expect(global.nodes.map(node => node.key)).toEqual(expect.arrayContaining(['you', 'path:path_8e2f1c6a', 'goal:goal_test']))
    expect(global.nodes.some(node => node.type === 'PHASE')).toBe(false)
    const goal = layoutSystemGraph(data, { type: 'GOAL', id: 'goal_test' })
    expect(goal.nodes.map(node => node.key)).toEqual(expect.arrayContaining(['phase:phase_one', 'step:step_one', 'step:step_two']))
    expect(goal.edges.some(edge => edge.type === 'PREREQUISITE')).toBe(true)
  })

  it('filters archived records and keeps layout deterministic across title edits', () => {
    const data = roadmapFixture()
    const first = layoutSystemGraph(data)
    const renamed = { ...data, goals: data.goals.map(goal => ({ ...goal, title: `${goal.title} renamed` })) }
    const second = layoutSystemGraph(renamed)
    expect(second.nodes.find(node => node.sourceId === 'goal_test')?.position).toEqual(first.nodes.find(node => node.sourceId === 'goal_test')?.position)
    expect(layoutSystemGraph(data, { type: 'GLOBAL' }, 'ALL').nodes.length).toBeGreaterThanOrEqual(first.nodes.length)
  })

  it('searches paths, goals, phases and steps', () => {
    const result = searchSystemGraph(roadmapFixture(), 'dom', 'ALL')
    expect(result.some(item => item.type === 'STEP' && item.sourceId === 'step_two')).toBe(true)
  })
})

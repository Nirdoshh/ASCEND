import { describe, expect, it } from 'vitest'
import { layoutSystemGraph, searchSystemGraph } from './systemGraph'
import { roadmapFixture } from '../test/systemRoadmapFixtures'

describe('system graph projection', () => {
  it('finds resting Goals and excludes archived parent branches from ACTIVE search', () => {
    const initial = roadmapFixture()
    const paused = { ...initial, goals: initial.goals.map(goal => ({ ...goal, status: 'PAUSED' as const })) }
    expect(searchSystemGraph(paused, 'Learn', 'ACTIVE')).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: 'goal_test' })]))
    const archivedRoute = { ...initial, roadmaps: initial.roadmaps.map(route => ({ ...route, status: 'ARCHIVED' as const })) }
    expect(searchSystemGraph(archivedRoute, 'DOM', 'ACTIVE')).toEqual([])
    expect(searchSystemGraph(archivedRoute, 'DOM', 'ALL')).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: 'step_two' })]))
    const archivedPhase = { ...initial, roadmapPhases: initial.roadmapPhases.map(phase => ({ ...phase, archivedAt: '2026-10-02T12:00:00.000Z' })) }
    expect(searchSystemGraph(archivedPhase, 'DOM', 'ACTIVE')).toEqual([])
  })

  it('keeps a single Phase and its Steps clear of the YOU anchor', () => {
    const initial = roadmapFixture()
    const data = { ...initial, roadmapPhases: initial.roadmapPhases.slice(0, 1), roadmapSteps: initial.roadmapSteps.slice(0, 1) }
    const graph = layoutSystemGraph(data, { type: 'GOAL', id: 'goal_test' })
    const anchor = graph.nodes.find(node => node.type === 'YOU')!
    for (const node of graph.nodes.filter(node => node.type === 'PHASE' || node.type === 'STEP')) {
      expect(Math.hypot(node.position.x - anchor.position.x, node.position.y - anchor.position.y)).toBeGreaterThan(70)
    }
  })

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

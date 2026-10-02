import type { SystemData, SystemGoal, SystemPath } from './systemPathGoal'
import { currentRoadmapStep, stepState, type RoadmapPhase, type RoadmapStep, type SystemRoadmap } from './systemRoadmap'

export type GraphNodeType = 'YOU' | 'PATH' | 'GOAL' | 'PHASE' | 'STEP'
export type GraphEdgeType = 'STRUCTURAL' | 'PREREQUISITE'
export type GraphFilter = 'ACTIVE' | 'ALL'
export type GraphFocus = { type: 'GLOBAL' } | { type: 'PATH'; id: string } | { type: 'GOAL'; id: string } | { type: 'PHASE'; id: string }
export type GraphPoint = { x: number; y: number }

export type GraphNode = {
  key: string
  sourceId: string | null
  type: GraphNodeType
  label: string
  position: GraphPoint
  status: string
  state?: string
  pathId?: string
  goalId?: string
  roadmapId?: string
  phaseId?: string
  parentKey?: string
  emphasis: 'primary' | 'normal' | 'quiet' | 'current'
  archived: boolean
  record: SystemPath | SystemGoal | SystemRoadmap | RoadmapPhase | RoadmapStep | null
}

export type GraphEdge = { key: string; from: string; to: string; type: GraphEdgeType; prerequisite?: boolean }
export type SystemGraph = { nodes: GraphNode[]; edges: GraphEdge[]; focus: GraphFocus; filter: GraphFilter; semanticLevel: 'GLOBAL' | 'PATH' | 'GOAL' | 'PHASE' }

const key = (type: GraphNodeType, id: string) => `${type.toLowerCase()}:${id}`
const normalized = (value: string) => value.trim().toLocaleLowerCase()
const visible = (status: string, filter: GraphFilter) => filter === 'ALL' || status !== 'ARCHIVED'
const activeGoal = (goal: SystemGoal) => goal.status === 'ACTIVE'
const sectorFor = (path: SystemPath, paths: readonly SystemPath[]) => {
  const name = normalized(path.name)
  if (name === 'mind') return { x: 0, y: -245 }
  if (name === 'body') return { x: -255, y: 55 }
  if (name === 'focus') return { x: 255, y: 55 }
  if (name === 'self') return { x: 0, y: 250 }
  const custom = paths.filter(p => !['mind', 'body', 'focus', 'self'].includes(normalized(p.name))).sort((a, b) => a.id.localeCompare(b.id))
  const index = Math.max(0, custom.findIndex(p => p.id === path.id))
  const angle = -Math.PI / 2 + ((index + 1) * (Math.PI * 2 / Math.max(4, custom.length + 4)))
  return { x: Math.round(Math.cos(angle) * 280), y: Math.round(Math.sin(angle) * 280) }
}

function addNode(nodes: GraphNode[], value: GraphNode) { if (!nodes.some(node => node.key === value.key)) nodes.push(value) }
function pathNode(path: SystemPath, paths: readonly SystemPath[]): GraphNode { const position = sectorFor(path, paths); return { key: key('PATH', path.id), sourceId: path.id, type: 'PATH', label: path.name, position, status: path.status, pathId: path.id, emphasis: path.status === 'ACTIVE' ? 'normal' : 'quiet', archived: path.status === 'ARCHIVED', record: path } }
function goalNode(goal: SystemGoal, position: GraphPoint, emphasis: GraphNode['emphasis'] = 'normal'): GraphNode { return { key: key('GOAL', goal.id), sourceId: goal.id, type: 'GOAL', label: goal.title, position, status: goal.status, pathId: goal.pathId, goalId: goal.id, emphasis, archived: goal.status === 'ARCHIVED', record: goal } }

export function layoutSystemGraph(data: SystemData, focus: GraphFocus = { type: 'GLOBAL' }, filter: GraphFilter = 'ACTIVE'): SystemGraph {
  const paths = data.paths.filter(path => visible(path.status, filter))
  const goals = data.goals.filter(goal => visible(goal.status, filter))
  const nodes: GraphNode[] = [{ key: 'you', sourceId: null, type: 'YOU', label: 'YOU', position: { x: 0, y: 0 }, status: 'ACTIVE', emphasis: 'primary', archived: false, record: null }]
  const edges: GraphEdge[] = []
  const addEdge = (from: string, to: string, type: GraphEdgeType = 'STRUCTURAL') => edges.push({ key: `${from}->${to}:${type}`, from, to, type, prerequisite: type === 'PREREQUISITE' })

  for (const path of paths) {
    const p = pathNode(path, paths); addNode(nodes, p); addEdge('you', p.key)
    const pathGoals = goals.filter(goal => goal.pathId === path.id && (focus.type !== 'GLOBAL' || activeGoal(goal) || filter === 'ALL'))
    for (const [index, goal] of pathGoals.entries()) {
      const base = p.position
      const focused = focus.type === 'PATH' && focus.id === path.id
      const angle = focused ? (-Math.PI / 2 + (index - (pathGoals.length - 1) / 2) * 0.48) : Math.atan2(base.y, base.x)
      const radius = focused ? 145 : 98
      const g = goalNode(goal, { x: Math.round(base.x + Math.cos(angle) * radius), y: Math.round(base.y + Math.sin(angle) * radius) }, focused || focus.type === 'GLOBAL' ? 'normal' : 'quiet')
      addNode(nodes, g); addEdge(p.key, g.key)
    }
  }

  if (focus.type === 'GOAL' || focus.type === 'PHASE') {
    const goal = data.goals.find(item => item.id === (focus.type === 'GOAL' ? focus.id : data.roadmapPhases.find(phase => phase.id === focus.id)?.roadmapId && data.roadmaps.find(route => route.id === data.roadmapPhases.find(phase => phase.id === focus.id)?.roadmapId)?.goalId))
    const roadmap = goal && data.roadmaps.find(route => route.goalId === goal.id)
    if (goal && roadmap && visible(roadmap.status, filter)) {
      const goalGraphNode = nodes.find(node => node.key === key('GOAL', goal.id))
      if (goalGraphNode) { goalGraphNode.position = { x: 0, y: -180 }; goalGraphNode.emphasis = 'primary' }
      const phases = data.roadmapPhases.filter(phase => phase.roadmapId === roadmap.id && (filter === 'ALL' || !phase.archivedAt)).sort((a, b) => a.order - b.order)
      for (const [phaseIndex, phase] of phases.entries()) {
        const phaseFocused = focus.type === 'PHASE' && focus.id === phase.id
        const phaseNode: GraphNode = { key: key('PHASE', phase.id), sourceId: phase.id, type: 'PHASE', label: phase.title, position: { x: (phaseIndex - (phases.length - 1) / 2) * 190, y: 5 }, status: phase.archivedAt ? 'ARCHIVED' : 'ACTIVE', goalId: goal.id, roadmapId: roadmap.id, phaseId: phase.id, parentKey: key('GOAL', goal.id), emphasis: phaseFocused ? 'primary' : 'normal', archived: Boolean(phase.archivedAt), record: phase }
        addNode(nodes, phaseNode); addEdge(key('GOAL', goal.id), phaseNode.key)
        if (phaseFocused || focus.type === 'GOAL') {
          const ordered = data.roadmapSteps.filter(step => step.roadmapId === roadmap.id && step.phaseId === phase.id && (filter === 'ALL' || !step.archivedAt)).sort((a, b) => a.order - b.order)
          const currentId = roadmap.activeStepId
          const steps = focus.type === 'GOAL' && ordered.length > 3
            ? [...ordered.slice(0, 3), ...(currentId && ordered.some(step => step.id === currentId && !ordered.slice(0, 3).some(item => item.id === currentId)) ? [ordered.find(step => step.id === currentId)!] : [])]
            : ordered
          for (const [stepIndex, step] of steps.entries()) {
            const state = stepState(data, roadmap, step)
            const stepNode: GraphNode = { key: key('STEP', step.id), sourceId: step.id, type: 'STEP', label: step.title, position: { x: phaseNode.position.x, y: 110 + stepIndex * 76 }, status: step.archivedAt ? 'ARCHIVED' : state, state, goalId: goal.id, roadmapId: roadmap.id, phaseId: phase.id, parentKey: phaseNode.key, emphasis: state === 'ACTIVE' ? 'current' : state === 'COMPLETED' ? 'quiet' : 'normal', archived: Boolean(step.archivedAt), record: step }
            addNode(nodes, stepNode); addEdge(phaseNode.key, stepNode.key)
            if (roadmap.type === 'SKILL') for (const prerequisite of step.prerequisiteStepIds) if (nodes.some(node => node.key === key('STEP', prerequisite))) addEdge(key('STEP', prerequisite), stepNode.key, 'PREREQUISITE')
          }
        }
      }
      // The current step is a semantic beacon even when its phase is not focused.
      const current = currentRoadmapStep(data, roadmap)
      if (current && focus.type === 'GOAL') {
        const node = nodes.find(item => item.key === key('STEP', current.step.id)); if (node) node.emphasis = 'current'
      }
    }
  }
  const semanticLevel = focus.type === 'GLOBAL' ? 'GLOBAL' : focus.type === 'PATH' ? 'PATH' : focus.type === 'GOAL' ? 'GOAL' : 'PHASE'
  return { nodes, edges, focus, filter, semanticLevel }
}

export const projectSystemGraph = layoutSystemGraph

export function searchSystemGraph(data: SystemData, query: string, filter: GraphFilter = 'ACTIVE'): Array<{ key: string; type: GraphNodeType; sourceId: string; label: string }> {
  const term = normalized(query); if (!term) return []
  const graph = layoutSystemGraph(data, { type: 'GLOBAL' }, filter)
  const records = [
    ...graph.nodes,
    ...data.roadmapPhases.filter(phase => filter === 'ALL' || !phase.archivedAt).map(phase => ({ key: key('PHASE', phase.id), type: 'PHASE' as const, sourceId: phase.id, label: phase.title })),
    ...data.roadmapSteps.filter(step => filter === 'ALL' || !step.archivedAt).map(step => ({ key: key('STEP', step.id), type: 'STEP' as const, sourceId: step.id, label: step.title })),
  ].filter((node, index, all) => node.sourceId && normalized(node.label).includes(term) && all.findIndex(other => other.key === node.key) === index)
  return records.map(node => ({ key: node.key, type: node.type, sourceId: node.sourceId!, label: node.label }))
}

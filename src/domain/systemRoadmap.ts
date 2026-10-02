import { createOpaqueId, type SystemData } from './systemPathGoal'

export const ROADMAP_SCHEMA_VERSION = 2
export type RoadmapType = 'SKILL' | 'GOAL'
export type RoadmapStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
export type RoadmapStepState = 'LOCKED' | 'AVAILABLE' | 'ACTIVE' | 'COMPLETED'

interface RecordBase {
  readonly schemaVersion: typeof ROADMAP_SCHEMA_VERSION
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly createdAt: string
  readonly updatedAt: string
}
export interface SystemRoadmap extends RecordBase {
  readonly goalId: string
  readonly type: RoadmapType
  readonly status: RoadmapStatus
  readonly activeStepId: string | null
}
export interface RoadmapPhase extends RecordBase {
  readonly roadmapId: string
  readonly order: number
  readonly archivedAt: string | null
}
export interface RoadmapStep extends RecordBase {
  readonly roadmapId: string
  readonly phaseId: string
  readonly order: number
  readonly optional: boolean
  readonly prerequisiteStepIds: readonly string[]
  readonly completedAt: string | null
  readonly archivedAt: string | null
}
export type RoadmapRecords = Pick<SystemData, 'roadmaps' | 'roadmapPhases' | 'roadmapSteps'>
export type RoadmapText = { title: string; description?: string }
export type RoadmapCommand =
  | ({ kind: 'create'; goalId: string; type: RoadmapType; id?: string } & RoadmapText)
  | ({ kind: 'edit'; roadmapId: string } & RoadmapText)
  | { kind: 'status'; roadmapId: string; status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }
  | ({ kind: 'add-phase'; roadmapId: string; id?: string } & RoadmapText)
  | ({ kind: 'edit-phase'; phaseId: string } & RoadmapText)
  | { kind: 'reorder-phases'; roadmapId: string; ids: readonly string[] }
  | { kind: 'archive-phase' | 'restore-phase'; phaseId: string }
  | ({ kind: 'add-step'; phaseId: string; id?: string; optional?: boolean; prerequisiteStepIds?: readonly string[] } & RoadmapText)
  | ({ kind: 'edit-step'; stepId: string; optional?: boolean; prerequisiteStepIds?: readonly string[] } & RoadmapText)
  | { kind: 'reorder-steps'; phaseId: string; ids: readonly string[] }
  | { kind: 'optional'; stepId: string; optional: boolean }
  | { kind: 'prerequisites'; stepId: string; ids: readonly string[] }
  | { kind: 'active'; roadmapId: string; stepId: string }
  | { kind: 'complete' | 'undo' | 'archive-step' | 'restore-step'; stepId: string }

export class RoadmapRuleError extends Error {}
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RoadmapRuleError(message)
}
function isDate(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function validText(value: unknown, required = false): boolean { return value === undefined && !required || typeof value === 'string' && value.length <= 500 && (!required || value.trim().length > 0) }
function base(value: unknown): value is Record<string, unknown> {
  return object(value) && value.schemaVersion === ROADMAP_SCHEMA_VERSION && typeof value.id === 'string' && value.id.trim() === value.id && value.id !== '' && validText(value.title, true) && validText(value.description) && isDate(value.createdAt) && isDate(value.updatedAt)
}
function ordered(value: Record<string, unknown>): boolean { return Number.isSafeInteger(value.order) && Number(value.order) >= 0 && (value.archivedAt === null || isDate(value.archivedAt)) }

/** Validate the complete collection, never salvage by dropping bad records. */
export function validRoadmapRecords(raw: Record<string, unknown>, goalIds: ReadonlySet<string>, existingIds: ReadonlySet<string>): boolean {
  if (!Array.isArray(raw.roadmaps) || !Array.isArray(raw.roadmapPhases) || !Array.isArray(raw.roadmapSteps)) return false
  const ids = new Set(existingIds)
  const unique = (value: Record<string, unknown>) => { if (ids.has(String(value.id))) return false; ids.add(String(value.id)); return true }
  const goals = new Set<string>()
  for (const r of raw.roadmaps) {
    if (!base(r) || !unique(r) || !goalIds.has(String(r.goalId)) || goals.has(String(r.goalId)) || !['SKILL', 'GOAL'].includes(String(r.type)) || !['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(String(r.status)) || !(r.activeStepId === null || typeof r.activeStepId === 'string')) return false
    goals.add(String(r.goalId))
  }
  const roadmaps = raw.roadmaps as SystemRoadmap[]
  const phases = raw.roadmapPhases as RoadmapPhase[]
  const steps = raw.roadmapSteps as RoadmapStep[]
  for (const p of phases) if (!base(p) || !unique(p) || !ordered(p) || !roadmaps.some(r => r.id === p.roadmapId)) return false
  for (const s of steps) {
    if (!base(s) || !unique(s) || !ordered(s) || typeof s.optional !== 'boolean' || !(s.completedAt === null || isDate(s.completedAt)) || !phases.some(p => p.id === s.phaseId && p.roadmapId === s.roadmapId) || !Array.isArray(s.prerequisiteStepIds) || new Set(s.prerequisiteStepIds).size !== s.prerequisiteStepIds.length) return false
    const roadmap = roadmaps.find(r => r.id === s.roadmapId)
    if (roadmap?.type === 'GOAL' && s.prerequisiteStepIds.length) return false
    for (const id of s.prerequisiteStepIds) {
      const prerequisite = steps.find(p => p.id === id && p.roadmapId === s.roadmapId)
      if (!prerequisite || id === s.id || s.completedAt && !prerequisite.completedAt) return false
      if (!s.archivedAt && !phases.find(p => p.id === s.phaseId)?.archivedAt && (prerequisite.archivedAt || phases.find(p => p.id === prerequisite.phaseId)?.archivedAt)) return false
    }
  }
  const visited = new Set<string>(), visiting = new Set<string>()
  const visit = (s: RoadmapStep): boolean => {
    if (visiting.has(s.id)) return false
    if (visited.has(s.id)) return true
    visiting.add(s.id)
    for (const id of s.prerequisiteStepIds) if (!visit(steps.find(p => p.id === id)!)) return false
    visiting.delete(s.id); visited.add(s.id); return true
  }
  if (!steps.every(visit)) return false
  const distinctOrder = (records: readonly (RoadmapPhase | RoadmapStep)[]) => new Set(records.map(r => r.order)).size === records.length
  for (const r of roadmaps) {
    if (!distinctOrder(phases.filter(p => p.roadmapId === r.id && !p.archivedAt))) return false
    if (r.activeStepId !== null) {
      const step = steps.find(s => s.id === r.activeStepId && s.roadmapId === r.id)
      if (!step || step.archivedAt || step.completedAt || phases.find(p => p.id === step.phaseId)?.archivedAt || step.prerequisiteStepIds.some(id => !steps.find(s => s.id === id)?.completedAt)) return false
    }
  }
  return phases.every(p => distinctOrder(steps.filter(s => s.phaseId === p.id && !s.archivedAt)))
}

export function orderedPhases(data: RoadmapRecords, roadmapId: string): RoadmapPhase[] {
  return data.roadmapPhases.filter(p => p.roadmapId === roadmapId && !p.archivedAt).sort((a, b) => a.order - b.order)
}
export function orderedSteps(data: RoadmapRecords, roadmapId: string, phaseId?: string): RoadmapStep[] {
  return orderedPhases(data, roadmapId).filter(p => !phaseId || p.id === phaseId).flatMap(p => data.roadmapSteps.filter(s => s.phaseId === p.id && !s.archivedAt).sort((a, b) => a.order - b.order))
}
export function stepState(data: RoadmapRecords, roadmap: SystemRoadmap, step: RoadmapStep): RoadmapStepState {
  if (step.completedAt) return 'COMPLETED'
  if (step.prerequisiteStepIds.some(id => !data.roadmapSteps.find(s => s.id === id)?.completedAt)) return 'LOCKED'
  return roadmap.activeStepId === step.id ? 'ACTIVE' : 'AVAILABLE'
}
export function roadmapProgress(data: RoadmapRecords, roadmapId: string) {
  const steps = orderedSteps(data, roadmapId)
  const required = steps.filter(s => !s.optional)
  return { total: steps.length, completed: steps.filter(s => s.completedAt).length, required: required.length, requiredCompleted: required.filter(s => s.completedAt).length }
}
/** A suggestion is derived; it never becomes an authored selection on read. */
export function currentRoadmapStep(data: RoadmapRecords, roadmap: SystemRoadmap): { step: RoadmapStep; selected: boolean } | null {
  if (roadmap.status === 'PAUSED' || roadmap.status === 'ARCHIVED') return null
  const steps = orderedSteps(data, roadmap.id)
  const selected = steps.find(s => s.id === roadmap.activeStepId && stepState(data, roadmap, s) === 'ACTIVE')
  if (selected) return { step: selected, selected: true }
  const next = steps.find(s => stepState(data, roadmap, s) === 'AVAILABLE' && !s.optional) ?? steps.find(s => stepState(data, roadmap, s) === 'AVAILABLE')
  return next ? { step: next, selected: false } : null
}

function text(input: RoadmapText): RoadmapText {
  requireRule(validText(input.title, true) && validText(input.description), 'Use a title and at most 500 characters per field.')
  return { title: input.title.trim(), description: input.description?.trim() || undefined }
}
function nextOrder(records: readonly { order: number }[]): number { return Math.max(-1, ...records.map(r => r.order)) + 1 }
function reorder<T extends { id: string; order: number; updatedAt: string }>(records: readonly T[], ids: readonly string[], now: string): T[] {
  requireRule(ids.length === records.length && new Set(ids).size === ids.length && records.every(r => ids.includes(r.id)), 'Choose each item exactly once when reordering.')
  return records.map(r => ({ ...r, order: ids.indexOf(r.id), updatedAt: now }))
}

/** Pure bounded edits. The application reloads and validates before persisting. */
export function applyRoadmapCommand(data: SystemData, command: RoadmapCommand, now: string): SystemData {
  requireRule(isDate(now), 'A valid timestamp is required.')
  let roadmaps = [...data.roadmaps], phases = [...data.roadmapPhases], steps = [...data.roadmapSteps]
  const findPhase = (id: string) => { const p = phases.find(p => p.id === id); requireRule(p, 'Phase not found.'); return p }
  const findStep = (id: string) => { const s = steps.find(s => s.id === id); requireRule(s, 'Step not found.'); return s }
  const roadmapId = 'roadmapId' in command ? command.roadmapId : 'phaseId' in command ? findPhase(command.phaseId).roadmapId : 'stepId' in command ? findStep(command.stepId).roadmapId : null
  const roadmap = roadmaps.find(r => r.id === roadmapId)
  if (command.kind !== 'create') {
    requireRule(roadmap, 'Roadmap not found.')
    requireRule(roadmap.status !== 'ARCHIVED' || command.kind === 'status', 'Restore the Roadmap before editing it.')
  }
  const baseRecord = (prefix: 'roadmap' | 'phase' | 'roadmap-step', input: RoadmapText, id?: string): RecordBase => ({ schemaVersion: ROADMAP_SCHEMA_VERSION, id: id ?? createOpaqueId(prefix), ...text(input), createdAt: now, updatedAt: now })
  switch (command.kind) {
    case 'create':
      requireRule(data.goals.some(g => g.id === command.goalId && g.status !== 'ARCHIVED'), 'Choose an existing, unarchived Goal.')
      requireRule(!roadmaps.some(r => r.goalId === command.goalId), 'This Goal already has a Roadmap. Restore or edit that route.')
      requireRule(command.type === 'SKILL' || command.type === 'GOAL', 'Choose SKILL or GOAL.')
      roadmaps.push({ ...baseRecord('roadmap', command, command.id), goalId: command.goalId, type: command.type, status: 'ACTIVE', activeStepId: null })
      break
    case 'edit': roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, ...text(command), updatedAt: now } : r); break
    case 'status':
      requireRule(['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(command.status), 'Invalid Roadmap status.')
      roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, status: command.status, updatedAt: now } : r); break
    case 'add-phase': phases.push({ ...baseRecord('phase', command, command.id), roadmapId: roadmapId!, order: nextOrder(phases.filter(p => p.roadmapId === roadmapId)), archivedAt: null }); break
    case 'edit-phase': phases = phases.map(p => p.id === command.phaseId ? { ...p, ...text(command), updatedAt: now } : p); break
    case 'reorder-phases': {
      const ordered = reorder(phases.filter(p => p.roadmapId === roadmapId && !p.archivedAt), command.ids, now)
      phases = phases.map(p => ordered.find(o => o.id === p.id) ?? p); break
    }
    case 'archive-phase': case 'restore-phase': {
      const p = findPhase(command.phaseId)
      phases = phases.map(entry => entry.id === p.id ? { ...entry, archivedAt: command.kind === 'archive-phase' ? now : null, order: command.kind === 'restore-phase' ? nextOrder(phases.filter(other => other.roadmapId === p.roadmapId)) : entry.order, updatedAt: now } : entry)
      if (command.kind === 'archive-phase' && steps.some(s => s.phaseId === p.id && s.id === roadmap?.activeStepId)) roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, activeStepId: null } : r)
      break
    }
    case 'add-step': {
      const p = findPhase(command.phaseId); requireRule(!p.archivedAt, 'Restore this Phase first.')
      steps.push({ ...baseRecord('roadmap-step', command, command.id), roadmapId: p.roadmapId, phaseId: p.id, order: nextOrder(steps.filter(s => s.phaseId === p.id)), optional: command.optional ?? false, prerequisiteStepIds: command.prerequisiteStepIds ?? [], completedAt: null, archivedAt: null }); break
    }
    case 'edit-step': steps = steps.map(s => s.id === command.stepId ? { ...s, ...text(command), optional: command.optional ?? s.optional, prerequisiteStepIds: command.prerequisiteStepIds ?? s.prerequisiteStepIds, updatedAt: now } : s); break
    case 'reorder-steps': {
      const ordered = reorder(steps.filter(s => s.phaseId === command.phaseId && !s.archivedAt), command.ids, now)
      steps = steps.map(s => ordered.find(o => o.id === s.id) ?? s); break
    }
    case 'optional': steps = steps.map(s => s.id === command.stepId ? { ...s, optional: command.optional, updatedAt: now } : s); break
    case 'prerequisites': steps = steps.map(s => s.id === command.stepId ? { ...s, prerequisiteStepIds: [...command.ids], updatedAt: now } : s); break
    case 'active': {
      const s = findStep(command.stepId)
      requireRule(s.roadmapId === roadmapId && !s.archivedAt && !findPhase(s.phaseId).archivedAt && stepState(data, roadmap!, s) === 'AVAILABLE' && roadmap?.status !== 'PAUSED', 'Choose an available Step in this Roadmap.')
      roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, activeStepId: s.id } : r); break
    }
    case 'complete': case 'undo': {
      const s = findStep(command.stepId)
      requireRule(!s.archivedAt && !findPhase(s.phaseId).archivedAt && roadmap?.status !== 'PAUSED', 'Resume or restore this route before changing completion.')
      requireRule(command.kind === 'undo' ? s.completedAt : !s.completedAt && stepState(data, roadmap!, s) !== 'LOCKED', 'Complete prerequisites first, or choose a completed Step to undo.')
      steps = steps.map(entry => entry.id === s.id ? { ...entry, completedAt: command.kind === 'complete' ? now : null, updatedAt: now } : entry)
      if (roadmap?.activeStepId === s.id) roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, activeStepId: null } : r)
      break
    }
    case 'archive-step': case 'restore-step': {
      const s = findStep(command.stepId)
      requireRule(!findPhase(s.phaseId).archivedAt, 'Restore the Phase first.')
      steps = steps.map(entry => entry.id === s.id ? { ...entry, archivedAt: command.kind === 'archive-step' ? now : null, order: command.kind === 'restore-step' ? nextOrder(steps.filter(other => other.phaseId === s.phaseId)) : entry.order, updatedAt: now } : entry)
      if (command.kind === 'archive-step' && roadmap?.activeStepId === s.id) roadmaps = roadmaps.map(r => r.id === roadmapId ? { ...r, activeStepId: null } : r)
      break
    }
  }
  let next = { ...data, roadmaps, roadmapPhases: phases, roadmapSteps: steps }
  requireRule(validRoadmapRecords(next as unknown as Record<string, unknown>, new Set(data.goals.map(g => g.id)), new Set([...data.paths, ...data.goals].map(r => r.id))), 'This change would create an invalid dependency, cycle, duplicate, or ordering. A current or completed Step may depend on it; preserve that history first.')
  roadmaps = roadmaps.map(r => {
    if (r.id !== roadmapId) return r
    const progress = roadmapProgress(next, r.id)
    const finished = progress.total > 0 && (progress.required > 0 ? progress.requiredCompleted === progress.required : progress.completed === progress.total)
    return { ...r, status: r.status === 'ACTIVE' && finished ? 'COMPLETED' : r.status === 'COMPLETED' && !finished ? 'ACTIVE' : r.status, updatedAt: now }
  })
  next = { ...next, roadmaps }
  return next
}

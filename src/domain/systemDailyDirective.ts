import type { SystemData, SystemGoal, SystemPath } from './systemPathGoal'
import type { RoadmapPhase, RoadmapStep, SystemRoadmap } from './systemRoadmap'

export type DailyDirectiveSourceType = 'ROADMAP_STEP' | 'MANUAL'
export type DailyDirectiveStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED'

export interface SystemDailyDirective {
  readonly schemaVersion: 1
  readonly id: string
  readonly dateKey: string
  readonly title: string
  readonly description?: string
  readonly why?: string
  readonly sourceType: DailyDirectiveSourceType
  readonly sourceRoadmapStepId?: string
  readonly status: DailyDirectiveStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
}

export interface SystemDirectiveObjective {
  readonly schemaVersion: 1
  readonly id: string
  readonly directiveId: string
  readonly title: string
  readonly order: number
  readonly completedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type DirectiveCandidate = {
  readonly path: SystemPath
  readonly goal: SystemGoal
  readonly roadmap: SystemRoadmap
  readonly phase: RoadmapPhase
  readonly step: RoadmapStep
  readonly selected: boolean
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && localDateKey(new Date(`${value}T12:00:00`)) === value
}

export function createDirectiveId(): string {
  const source = globalThis.crypto
  const suffix = typeof source?.randomUUID === 'function'
    ? source.randomUUID().replaceAll('-', '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `directive_${suffix}`
}

export function createObjectiveId(): string {
  return `directive-objective_${createDirectiveId().slice('directive_'.length)}`
}

function text(value: string | undefined, required: boolean): string | undefined {
  const trimmed = value?.trim() ?? ''
  if (required && trimmed === '') throw new RangeError('A title is required')
  if (trimmed.length > 500) throw new RangeError('Text is too long')
  return trimmed || undefined
}

export function createDailyDirective(input: {
  readonly dateKey: string
  readonly title: string
  readonly description?: string
  readonly why?: string
  readonly sourceType: DailyDirectiveSourceType
  readonly sourceRoadmapStepId?: string
  readonly now: string
  readonly id?: string
}): SystemDailyDirective {
  if (!isDateKey(input.dateKey)) throw new RangeError('A local calendar date is required')
  if (!Number.isFinite(Date.parse(input.now))) throw new RangeError('A valid timestamp is required')
  if (input.sourceType === 'ROADMAP_STEP' && !input.sourceRoadmapStepId) throw new RangeError('Roadmap directives need a source Step')
  const description = text(input.description, false)
  const why = text(input.why, false)
  return {
    schemaVersion: 1,
    id: input.id ?? createDirectiveId(),
    dateKey: input.dateKey,
    title: text(input.title, true)!,
    ...(description ? { description } : {}),
    ...(why ? { why } : {}),
    sourceType: input.sourceType,
    ...(input.sourceRoadmapStepId ? { sourceRoadmapStepId: input.sourceRoadmapStepId } : {}),
    status: 'ACTIVE',
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: null,
  }
}

export function createDirectiveObjective(input: { readonly directiveId: string; readonly title: string; readonly order: number; readonly now: string; readonly id?: string }): SystemDirectiveObjective {
  if (!Number.isSafeInteger(input.order) || input.order < 0) throw new RangeError('Invalid objective order')
  return { schemaVersion: 1, id: input.id ?? createObjectiveId(), directiveId: input.directiveId, title: text(input.title, true)!, order: input.order, completedAt: null, createdAt: input.now, updatedAt: input.now }
}

function activeRoadmapStep(data: SystemData, roadmap: SystemRoadmap, step: RoadmapStep): boolean {
  if (roadmap.status !== 'ACTIVE' || step.archivedAt || step.completedAt) return false
  const phase = data.roadmapPhases.find(entry => entry.id === step.phaseId)
  if (!phase || phase.archivedAt) return false
  return step.prerequisiteStepIds.every(id => data.roadmapSteps.find(entry => entry.id === id)?.completedAt)
}

/** Pure candidate projection. Explicit active steps sort before available steps. */
export function deriveDirectiveCandidates(data: SystemData): DirectiveCandidate[] {
  const candidates: DirectiveCandidate[] = []
  for (const path of data.paths.filter(entry => entry.status === 'ACTIVE')) {
    for (const goal of data.goals.filter(entry => entry.pathId === path.id && entry.status === 'ACTIVE')) {
      const roadmap = data.roadmaps.find(entry => entry.goalId === goal.id && entry.status === 'ACTIVE')
      if (!roadmap) continue
      const steps = data.roadmapSteps
        .filter(step => step.roadmapId === roadmap.id && activeRoadmapStep(data, roadmap, step))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      const selected = steps.find(step => step.id === roadmap.activeStepId)
      const step = selected ?? steps.find(entry => !entry.optional) ?? steps[0]
      if (!step) continue
      const phase = data.roadmapPhases.find(entry => entry.id === step.phaseId)
      if (phase) candidates.push({ path, goal, roadmap, phase, step, selected: Boolean(selected) })
    }
  }
  return candidates.sort((a, b) => Number(b.selected) - Number(a.selected) || a.path.name.localeCompare(b.path.name) || a.goal.title.localeCompare(b.goal.title) || a.step.order - b.step.order || a.step.id.localeCompare(b.step.id))
}

export function normalizeDirective(raw: unknown): SystemDailyDirective | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (!validRecordTextAndCompletion(value)) return null
  if (value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id || !isDateKey(value.dateKey) || typeof value.title !== 'string' || !value.title.trim() || !['ROADMAP_STEP', 'MANUAL'].includes(String(value.sourceType)) || !['ACTIVE', 'COMPLETED', 'ABANDONED'].includes(String(value.status)) || typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt as string)) || typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt as string)) || !(value.completedAt === null || typeof value.completedAt === 'string')) return null
  if (value.sourceType === 'ROADMAP_STEP' && typeof value.sourceRoadmapStepId !== 'string') return null
  return { schemaVersion: 1, id: value.id, dateKey: value.dateKey, title: value.title.trim(), ...(typeof value.description === 'string' && value.description.trim() ? { description: value.description.trim() } : {}), ...(typeof value.why === 'string' && value.why.trim() ? { why: value.why.trim() } : {}), sourceType: value.sourceType as DailyDirectiveSourceType, ...(typeof value.sourceRoadmapStepId === 'string' ? { sourceRoadmapStepId: value.sourceRoadmapStepId } : {}), status: value.status as DailyDirectiveStatus, createdAt: value.createdAt, updatedAt: value.updatedAt, completedAt: value.completedAt as string | null }
}

export function normalizeDirectiveObjective(raw: unknown): SystemDirectiveObjective | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (!validRecordTextAndCompletion(value)) return null
  if (value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id || typeof value.directiveId !== 'string' || !value.directiveId || typeof value.title !== 'string' || !value.title.trim() || !Number.isSafeInteger(value.order) || Number(value.order) < 0 || !(value.completedAt === null || typeof value.completedAt === 'string') || typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt as string)) || typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt as string))) return null
  return { schemaVersion: 1, id: value.id, directiveId: value.directiveId, title: value.title.trim(), order: value.order as number, completedAt: value.completedAt as string | null, createdAt: value.createdAt, updatedAt: value.updatedAt }
}

function validRecordTextAndCompletion(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && value.id.trim() !== '' && value.id === value.id.trim()
    && typeof value.title === 'string' && value.title.trim().length > 0 && value.title.trim().length <= 500
    && ['description', 'why'].every(key => value[key] === undefined || typeof value[key] === 'string' && value[key].trim().length <= 500)
    && (value.completedAt === null || typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt)))
}

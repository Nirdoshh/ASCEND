import { validRoadmapRecords, type SystemRoadmap, type RoadmapPhase, type RoadmapStep } from './systemRoadmap'

export const SYSTEM_SCHEMA_VERSION = 2
// Path and Goal contracts are unchanged; their record version remains Beta 1.
const SYSTEM_RECORD_SCHEMA_VERSION = 1

export type PathStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
export type PathSource = 'SUGGESTED' | 'CUSTOM'

export interface SystemPath {
  readonly schemaVersion: typeof SYSTEM_RECORD_SCHEMA_VERSION
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly source: PathSource
  readonly status: PathStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SystemGoal {
  readonly schemaVersion: typeof SYSTEM_RECORD_SCHEMA_VERSION
  readonly id: string
  readonly pathId: string
  readonly title: string
  readonly description?: string
  readonly why?: string
  readonly status: GoalStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
}

export interface SystemData {
  readonly schemaVersion: typeof SYSTEM_SCHEMA_VERSION
  readonly paths: readonly SystemPath[]
  readonly goals: readonly SystemGoal[]
  readonly roadmaps: readonly SystemRoadmap[]
  readonly roadmapPhases: readonly RoadmapPhase[]
  readonly roadmapSteps: readonly RoadmapStep[]
}

const PATH_STATUSES: readonly PathStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED']
const GOAL_STATUSES: readonly GoalStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']
const MAX_NAME_LENGTH = 80
const MAX_TEXT_LENGTH = 500

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function createOpaqueId(prefix: 'path' | 'goal' | 'roadmap' | 'phase' | 'roadmap-step'): string {
  const source = globalThis.crypto
  if (typeof source?.randomUUID === 'function') {
    return `${prefix}_${source.randomUUID().replaceAll('-', '')}`
  }
  if (typeof source?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    source.getRandomValues(bytes)
    return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

export function createPath(input: {
  readonly name: string
  readonly description?: string
  readonly source?: PathSource
  readonly now: string
  readonly id?: string
}): SystemPath {
  const name = input.name.trim()
  if (name === '' || name.length > MAX_NAME_LENGTH) throw new RangeError('Path name is invalid')
  const description = trimOptional(input.description)
  if (description && description.length > MAX_TEXT_LENGTH) throw new RangeError('Path description is too long')
  return {
    schemaVersion: SYSTEM_RECORD_SCHEMA_VERSION,
    id: input.id ?? createOpaqueId('path'),
    name,
    ...(description ? { description } : {}),
    source: input.source ?? 'CUSTOM',
    status: 'ACTIVE',
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function createGoal(input: {
  readonly pathId: string
  readonly title: string
  readonly description?: string
  readonly why?: string
  readonly now: string
  readonly id?: string
}): SystemGoal {
  const title = input.title.trim()
  if (title === '' || title.length > MAX_TEXT_LENGTH) throw new RangeError('Goal title is invalid')
  const description = trimOptional(input.description)
  const why = trimOptional(input.why)
  if (description && description.length > MAX_TEXT_LENGTH) throw new RangeError('Goal description is too long')
  if (why && why.length > MAX_TEXT_LENGTH) throw new RangeError('Goal WHY is too long')
  if (input.pathId.trim() === '') throw new RangeError('Goal needs a Path')
  return {
    schemaVersion: SYSTEM_RECORD_SCHEMA_VERSION,
    id: input.id ?? createOpaqueId('goal'),
    pathId: input.pathId.trim(),
    title,
    ...(description ? { description } : {}),
    ...(why ? { why } : {}),
    status: 'ACTIVE',
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: null,
  }
}

export function updatePath(path: SystemPath, input: { readonly name: string; readonly description?: string; readonly now: string }): SystemPath {
  const next = createPath({ ...input, id: path.id, source: path.source })
  return { ...next, status: path.status, createdAt: path.createdAt }
}

export function updateGoal(goal: SystemGoal, input: { readonly title: string; readonly description?: string; readonly why?: string; readonly now: string }): SystemGoal {
  const next = createGoal({ ...input, id: goal.id, pathId: goal.pathId })
  return { ...next, status: goal.status, createdAt: goal.createdAt, completedAt: goal.completedAt }
}

export function changePathStatus(path: SystemPath, status: PathStatus, now: string): SystemPath {
  return { ...path, status, updatedAt: now }
}

export function changeGoalStatus(goal: SystemGoal, status: GoalStatus, now: string): SystemGoal {
  return {
    ...goal,
    status,
    updatedAt: now,
    completedAt: status === 'COMPLETED' ? (goal.completedAt ?? now) : null,
  }
}

export function createSystemData(paths: readonly SystemPath[] = [], goals: readonly SystemGoal[] = []): SystemData {
  return { schemaVersion: SYSTEM_SCHEMA_VERSION, paths: [...paths], goals: [...goals], roadmaps: [], roadmapPhases: [], roadmapSteps: [] }
}

/** Suggested starting directions. These are ordinary persisted Path records, not fixtures. */
export function createSuggestedSystemData(now: string): SystemData {
  const suggestions = [
    ['path_4b7d2a9c', 'BODY', 'What am I training?'],
    ['path_8e2f1c6a', 'MIND', 'What am I learning?'],
    ['path_3d9a6f20', 'FOCUS', 'What deserves my attention?'],
    ['path_6c1e8b54', 'SELF', 'Who am I becoming?'],
  ] as const
  return createSystemData(suggestions.map(([id, name, description]) => createPath({ id, name, description, source: 'SUGGESTED', now })))
}

export function normalizeSystemData(raw: unknown): SystemData | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (value.schemaVersion !== SYSTEM_SCHEMA_VERSION || !Array.isArray(value.paths) || !Array.isArray(value.goals)) return null

  const paths: SystemPath[] = []
  const pathIds = new Set<string>()
  for (const entry of value.paths) {
    const path = normalizePath(entry)
    if (!path || pathIds.has(path.id)) return null
    pathIds.add(path.id)
    paths.push(path)
  }

  const goals: SystemGoal[] = []
  const goalIds = new Set<string>()
  for (const entry of value.goals) {
    const goal = normalizeGoal(entry)
    if (!goal || goalIds.has(goal.id) || pathIds.has(goal.id) || !pathIds.has(goal.pathId)) return null
    goalIds.add(goal.id)
    goals.push(goal)
  }
  if (!validRoadmapRecords(value, goalIds, new Set([...pathIds, ...goalIds]))) return null
  // Keep original authored text and unknown fields; validation must not truncate.
  return { ...value, schemaVersion: SYSTEM_SCHEMA_VERSION, paths: value.paths as SystemPath[], goals: value.goals as SystemGoal[], roadmaps: value.roadmaps as SystemRoadmap[], roadmapPhases: value.roadmapPhases as RoadmapPhase[], roadmapSteps: value.roadmapSteps as RoadmapStep[] }
}

function normalizePath(raw: unknown): SystemPath | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const id = typeof value.id === 'string' && value.id.trim() !== '' ? value.id.trim() : null
  if (id !== value.id) return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const source = value.source === 'SUGGESTED' || value.source === 'CUSTOM' ? value.source : null
  const status = PATH_STATUSES.includes(value.status as PathStatus) ? value.status as PathStatus : null
  if (value.schemaVersion !== SYSTEM_RECORD_SCHEMA_VERSION || !id || !source || !status || name === '' || name.length > MAX_NAME_LENGTH || !validDate(value.createdAt) || !validDate(value.updatedAt) || value.description !== undefined && typeof value.description !== 'string') return null
  const description = trimOptional(value.description)
  if (description && description.length > MAX_TEXT_LENGTH) return null
  return { schemaVersion: SYSTEM_RECORD_SCHEMA_VERSION, id, name, ...(description ? { description } : {}), source, status, createdAt: value.createdAt, updatedAt: value.updatedAt }
}

function normalizeGoal(raw: unknown): SystemGoal | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const id = typeof value.id === 'string' && value.id.trim() !== '' ? value.id.trim() : null
  const pathId = typeof value.pathId === 'string' && value.pathId.trim() !== '' ? value.pathId.trim() : null
  if (id !== value.id || pathId !== value.pathId) return null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const status = GOAL_STATUSES.includes(value.status as GoalStatus) ? value.status as GoalStatus : null
  if (value.schemaVersion !== SYSTEM_RECORD_SCHEMA_VERSION || !id || !pathId || !status || title === '' || title.length > MAX_TEXT_LENGTH || !validDate(value.createdAt) || !validDate(value.updatedAt) || value.description !== undefined && typeof value.description !== 'string' || value.why !== undefined && typeof value.why !== 'string') return null
  const description = trimOptional(value.description)
  const why = trimOptional(value.why)
  if (description && description.length > MAX_TEXT_LENGTH || why && why.length > MAX_TEXT_LENGTH) return null
  if (status === 'COMPLETED') {
    if (!validDate(value.completedAt)) return null
  } else if (value.completedAt !== null) {
    return null
  }
  return { schemaVersion: SYSTEM_RECORD_SCHEMA_VERSION, id, pathId, title, ...(description ? { description } : {}), ...(why ? { why } : {}), status, createdAt: value.createdAt, updatedAt: value.updatedAt, completedAt: status === 'COMPLETED' ? value.completedAt : null }
}

export function hasNewerSystemSchema(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const value = raw as Record<string, unknown>
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > SYSTEM_SCHEMA_VERSION) return true
  for (const [records, version] of [[value.paths, 1], [value.goals, 1], [value.roadmaps, 2], [value.roadmapPhases, 2], [value.roadmapSteps, 2]] as const) {
    if (!Array.isArray(records)) continue
    if (records.some((entry: unknown) => typeof entry === 'object' && entry !== null && typeof (entry as Record<string, unknown>).schemaVersion === 'number' && Number((entry as Record<string, unknown>).schemaVersion) > version)) return true
  }
  return false
}

/** Read-only v1 → v2 migration. Persisted bytes change only on a successful edit. */
export function migrateSystemData(raw: unknown): SystemData | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (hasNewerSystemSchema(value)) return null
  if (value.schemaVersion === 1) {
    // Refuse conflicting unversioned extensions rather than replacing user data.
    if ('roadmaps' in value || 'roadmapPhases' in value || 'roadmapSteps' in value) return null
    return normalizeSystemData({ ...value, schemaVersion: 2, roadmaps: [], roadmapPhases: [], roadmapSteps: [] })
  }
  return normalizeSystemData(value)
}

import type { SystemRepository } from '../data/repositories/systemRepository'
import { applyRoadmapCommand, currentRoadmapStep, RoadmapRuleError, type RoadmapCommand, type RoadmapText, type RoadmapType } from '../domain/systemRoadmap'
import type { SystemData } from '../domain/systemPathGoal'

export type RoadmapOperationResult =
  | { ok: true; data: SystemData }
  | { ok: false; problem: string; message: string }

const storageMessages: Record<string, string> = {
  'storage-unavailable': 'Storage unavailable. Your changes are still in this form. Try again.',
  unavailable: 'Storage unavailable. Your changes are still in this form. Try again.',
  'quota-exceeded': 'Storage is full. Your changes are still in this form.',
  'newer-schema': 'This System needs a newer ASCEND version. Saved data is untouched.',
  'invalid-data': 'System data could not be read safely. Saved data is untouched.',
}
export function createSystemRoadmapService(repository: SystemRepository) {
  const execute = (command: RoadmapCommand, now: string): RoadmapOperationResult => {
    const loaded = repository.read()
    if (!loaded.ok) return { ok: false, problem: loaded.problem, message: storageMessages[loaded.problem]! }
    if (!loaded.value) return { ok: false, problem: 'not-found', message: 'Create a Goal first.' }
    try {
      const data = applyRoadmapCommand(loaded.value, command, now)
      const saved = repository.save(data)
      return saved === 'ok' ? { ok: true, data } : { ok: false, problem: saved, message: storageMessages[saved]! }
    } catch (error) {
      if (!(error instanceof RoadmapRuleError)) throw error
      return { ok: false, problem: 'invalid-input', message: error.message }
    }
  }
  return {
    execute,
    create: (goalId: string, type: RoadmapType, input: RoadmapText, now: string) => execute({ kind: 'create', goalId, type, ...input }, now),
    edit: (roadmapId: string, input: RoadmapText, now: string) => execute({ kind: 'edit', roadmapId, ...input }, now),
    pause: (roadmapId: string, now: string) => execute({ kind: 'status', roadmapId, status: 'PAUSED' }, now),
    resume: (roadmapId: string, now: string) => execute({ kind: 'status', roadmapId, status: 'ACTIVE' }, now),
    archive: (roadmapId: string, now: string) => execute({ kind: 'status', roadmapId, status: 'ARCHIVED' }, now),
    addPhase: (roadmapId: string, input: RoadmapText, now: string) => execute({ kind: 'add-phase', roadmapId, ...input }, now),
    editPhase: (phaseId: string, input: RoadmapText, now: string) => execute({ kind: 'edit-phase', phaseId, ...input }, now),
    reorderPhases: (roadmapId: string, ids: readonly string[], now: string) => execute({ kind: 'reorder-phases', roadmapId, ids }, now),
    archivePhase: (phaseId: string, now: string) => execute({ kind: 'archive-phase', phaseId }, now),
    restorePhase: (phaseId: string, now: string) => execute({ kind: 'restore-phase', phaseId }, now),
    addStep: (phaseId: string, input: RoadmapText & { optional?: boolean; prerequisiteStepIds?: readonly string[] }, now: string) => execute({ kind: 'add-step', phaseId, ...input }, now),
    editStep: (stepId: string, input: RoadmapText, now: string) => execute({ kind: 'edit-step', stepId, ...input }, now),
    reorderSteps: (phaseId: string, ids: readonly string[], now: string) => execute({ kind: 'reorder-steps', phaseId, ids }, now),
    setOptional: (stepId: string, optional: boolean, now: string) => execute({ kind: 'optional', stepId, optional }, now),
    setPrerequisites: (stepId: string, ids: readonly string[], now: string) => execute({ kind: 'prerequisites', stepId, ids }, now),
    setActive: (roadmapId: string, stepId: string, now: string) => execute({ kind: 'active', roadmapId, stepId }, now),
    complete: (stepId: string, now: string) => execute({ kind: 'complete', stepId }, now),
    undoComplete: (stepId: string, now: string) => execute({ kind: 'undo', stepId }, now),
    archiveStep: (stepId: string, now: string) => execute({ kind: 'archive-step', stepId }, now),
    restoreStep: (stepId: string, now: string) => execute({ kind: 'restore-step', stepId }, now),
    getCurrentStep(goalId: string) {
      const loaded = repository.read()
      if (!loaded.ok) return loaded
      const roadmap = loaded.value?.roadmaps.find(r => r.goalId === goalId)
      return { ok: true as const, value: roadmap && loaded.value ? currentRoadmapStep(loaded.value, roadmap) : null }
    },
  }
}
export type SystemRoadmapService = ReturnType<typeof createSystemRoadmapService>

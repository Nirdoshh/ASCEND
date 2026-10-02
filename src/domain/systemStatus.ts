import type { SystemData } from './systemPathGoal'

/** Recorded facts only. Completion counts include retained archived history. */
export function systemStatus(data: SystemData) {
  const stepsForPath = (pathId: string) => data.roadmapSteps.filter(step => {
    const route = data.roadmaps.find(entry => entry.id === step.roadmapId)
    return data.goals.some(goal => goal.id === route?.goalId && goal.pathId === pathId)
  })
  return {
    activePaths: data.paths.filter(path => path.status === 'ACTIVE').length,
    activeGoals: data.goals.filter(goal => goal.status === 'ACTIVE').length,
    completedGoals: data.goals.filter(goal => goal.completedAt).length,
    completedSteps: data.roadmapSteps.filter(step => step.completedAt).length,
    completedDirectives: data.directives.filter(directive => directive.status === 'COMPLETED').length,
    completedObjectives: data.directiveObjectives.filter(objective => objective.completedAt).length,
    paths: data.paths.map(path => ({
      id: path.id, name: path.name, status: path.status,
      activeGoals: data.goals.filter(goal => goal.pathId === path.id && goal.status === 'ACTIVE').length,
      completedSteps: stepsForPath(path.id).filter(step => step.completedAt).length,
    })),
  }
}

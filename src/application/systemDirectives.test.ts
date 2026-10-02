import { beforeEach, describe, expect, it } from 'vitest'

import { createSystemDirectiveService } from './systemDirectives'
import { createSystemRepository } from '../data/repositories/systemRepository'
import { createWebStorageStore } from '../data/storage/webStorageStore'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../test/systemRoadmapFixtures'

beforeEach(() => window.localStorage.clear())

describe('System Daily Directive application service', () => {
  it('accepts a Roadmap candidate, persists objectives, and preserves replacement history', () => {
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.save(roadmapFixture())).toBe('ok')
    const service = createSystemDirectiveService(repository)
    const candidate = service.candidates()[0]!
    const accepted = service.accept(candidate, { dateKey: '2026-10-02', now: NOW })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const directive = accepted.data.directives[0]!
    expect(accepted.data.directiveObjectives[0]?.title).toBe(candidate.step.title)
    const added = service.objectiveAdd(directive.id, 'Practice once', NOW)
    expect(added.ok).toBe(true)
    expect(service.replace(directive.id, { title: 'Manual focus', now: NOW }).ok).toBe(true)
    const records = repository.load()!
    expect(records.directives.find(entry => entry.id === directive.id)?.status).toBe('ABANDONED')
    expect(records.directives.filter(entry => entry.dateKey === '2026-10-02' && entry.status === 'ACTIVE')).toHaveLength(1)
  })

  it('requires objective completion before completing the directive and delegates Roadmap completion explicitly', () => {
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.save(roadmapFixture())).toBe('ok')
    const service = createSystemDirectiveService(repository)
    const candidate = service.candidates()[0]!
    const accepted = service.accept(candidate, { dateKey: '2026-10-02', now: NOW })
    if (!accepted.ok) throw new Error('directive setup failed')
    const directive = accepted.data.directives[0]!
    expect(service.complete(directive.id, NOW).ok).toBe(false)
    expect(service.objectiveToggle(accepted.data.directiveObjectives[0]!.id, NOW).ok).toBe(true)
    expect(service.complete(directive.id, NOW).ok).toBe(true)
    expect(service.completeLinkedRoadmapStep(directive.id, NOW).ok).toBe(true)
    expect(repository.load()!.roadmapSteps.find(step => step.id === candidate.step.id)?.completedAt).toBe(NOW)
  })
})

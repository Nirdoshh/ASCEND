import { beforeEach, describe, expect, it } from 'vitest'

import { createSuggestedSystemData } from '../../domain/systemPathGoal'
import { roadmapFixture } from '../../test/systemRoadmapFixtures'
import { createDailyDirective, createDirectiveObjective } from '../../domain/systemDailyDirective'
import { createSystemDirectiveService } from '../../application/systemDirectives'
import { ASCEND_SYSTEM_KEY } from '../storage/keys'
import { createWebStorageStore, type KeyValueStore } from '../storage/webStorageStore'
import { createSystemRepository } from './systemRepository'

const NOW = '2026-10-02T12:00:00.000Z'

beforeEach(() => window.localStorage.clear())

describe('System repository', () => {
  it.each(['directives', 'directiveObjectives'])('refuses conflicting v2 %s without overwriting recoverable data', field => {
    const { directives: _directives, directiveObjectives: _objectives, ...records } = roadmapFixture()
    const bytes = JSON.stringify({ ...records, schemaVersion: 2, [field]: [{ text: 'recover me' }] })
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.read()).toEqual({ ok: false, problem: 'invalid-data' })
    expect(repository.save(roadmapFixture())).toBe('invalid-data')
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })

  it('preserves authored text and record extensions through v3 reads and Directive edits', () => {
    const directive = { ...createDailyDirective({ id: 'directive_original', dateKey: '2026-10-02', title: 'Real focus', sourceType: 'MANUAL', now: NOW }), title: '  Real focus  ', userExtension: 'keep directive context' }
    const objective = { ...createDirectiveObjective({ directiveId: directive.id, id: 'objective_original', title: 'Real objective', order: 0, now: NOW }), title: '  Real objective  ', userExtension: 'keep objective context' }
    const data = { ...roadmapFixture(), directives: [directive], directiveObjectives: [objective] }
    const repository = createSystemRepository(createWebStorageStore())
    expect(repository.save(data)).toBe('ok')
    expect(repository.load()).toEqual(data)
    expect(createSystemDirectiveService(repository).edit(directive.id, { title: 'Explicit edit', now: NOW }).ok).toBe(true)
    const saved = JSON.parse(window.localStorage.getItem(ASCEND_SYSTEM_KEY)!)
    expect(saved.directives[0]).toMatchObject({ title: 'Explicit edit', userExtension: directive.userExtension })
    expect(saved.directiveObjectives[0]).toEqual(objective)
  })

  it.each(['directive-version', 'objective-version', 'directive-time', 'objective-time', 'date-key', 'objective-parent', 'objective-order', 'duplicate-active-day', 'cross-record-id'])('protects v3 %s data on read and write', kind => {
    const directive = createDailyDirective({ id: 'directive_original', dateKey: '2026-10-02', title: 'Real focus', sourceType: 'MANUAL', now: NOW })
    const objective = createDirectiveObjective({ directiveId: directive.id, id: 'objective_original', title: 'Real objective', order: 0, now: NOW })
    const data = { ...roadmapFixture(), directives: [directive], directiveObjectives: [objective] }
    const raw = structuredClone(data)
    if (kind === 'directive-version') Object.assign(raw.directives[0]!, { schemaVersion: 99 })
    if (kind === 'objective-version') Object.assign(raw.directiveObjectives[0]!, { schemaVersion: 99 })
    if (kind === 'directive-time') Object.assign(raw.directives[0]!, { completedAt: 'yesterday' })
    if (kind === 'objective-time') Object.assign(raw.directiveObjectives[0]!, { completedAt: 'yesterday' })
    if (kind === 'date-key') Object.assign(raw.directives[0]!, { dateKey: '2026-02-31' })
    if (kind === 'objective-parent') Object.assign(raw.directiveObjectives[0]!, { directiveId: 'missing' })
    if (kind === 'objective-order') raw.directiveObjectives.push({ ...objective, id: 'objective_other' })
    if (kind === 'duplicate-active-day') raw.directives.push({ ...directive, id: 'directive_other' })
    if (kind === 'cross-record-id') Object.assign(raw.directives[0]!, { id: raw.paths[0]!.id })
    const bytes = JSON.stringify(raw)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    const problem = kind.endsWith('version') ? 'newer-schema' : 'invalid-data'
    expect(repository.read()).toEqual({ ok: false, problem })
    expect(repository.save(data)).toBe(problem)
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })

  it('migrates v2 to v3 in memory, preserving authored fields and unknown extensions before a successful save', () => {
    const data = roadmapFixture()
    const { directives: _directives, directiveObjectives: _objectives, ...records } = data
    const legacy = { ...records, schemaVersion: 2, userExtension: { text: 'keep this' } }
    const bytes = JSON.stringify(legacy)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const repository = createSystemRepository(createWebStorageStore())
    const loaded = repository.load()!
    expect(loaded).toEqual({ ...legacy, schemaVersion: 3, directives: [], directiveObjectives: [] })
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
    expect(repository.save(loaded)).toBe('ok')
    expect(repository.load()).toEqual(loaded)
  })

  it('persists records and protects future or malformed data', () => {
    const repository = createSystemRepository(createWebStorageStore())
    const data = createSuggestedSystemData(NOW)
    expect(repository.save(data)).toBe('ok')
    expect(repository.read()).toEqual({ ok: true, value: data })
    const future = JSON.stringify({ schemaVersion: 99, paths: [], goals: [] })
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, future)
    expect(repository.read()).toEqual({ ok: false, problem: 'newer-schema' })
    expect(repository.save(data)).toBe('newer-schema')
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(future)
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, '{broken')
    expect(repository.read()).toEqual({ ok: false, problem: 'invalid-data' })
    expect(repository.save(data)).toBe('invalid-data')
  })

  it('reports storage failures without throwing', () => {
    const unavailable: KeyValueStore = {
      isAvailable: () => false,
      readResult: () => ({ ok: false, problem: 'storage-unavailable' }),
      keysWithPrefix: () => ({ ok: false, problem: 'storage-unavailable' }),
      read: () => null,
      write: () => 'unavailable',
      remove: () => undefined,
    }
    const repository = createSystemRepository(unavailable)
    expect(repository.read()).toEqual({ ok: false, problem: 'storage-unavailable' })
    expect(repository.save(createSuggestedSystemData(NOW))).toBe('unavailable')
  })
})

import { describe, expect, it } from 'vitest'
import { deriveProgressSnapshot } from './progress'
import { uncompleteDailyStep } from './dailyStep'
import { progressJourney, progressSourceDay } from '../test/progressFixtures'

const journey = progressJourney()
const derive = (history: Parameters<typeof deriveProgressSnapshot>[1]) =>
  deriveProgressSnapshot(journey, history, '2026-10-11', '2026-10-01')

describe('derived Progress', () => {
  it('represents no history without invented activity', () => {
    const snapshot = derive([])
    expect(snapshot).toMatchObject({ planDays: 0, totalActions: 0, completedActions: 0, activeDays: 0, fullyCompletedDays: 0 })
    expect(snapshot.recentDays).toHaveLength(7)
    expect(snapshot.recentDays.every(day => !day.hasPlan && !day.isActive && !day.isFullyComplete)).toBe(true)
  })

  it('counts one plan with a completed/incomplete mix', () => {
    expect(derive([progressSourceDay('2026-10-11', [true, false, true])])).toMatchObject({
      totalActions: 3, completedActions: 2, activeDays: 1, fullyCompletedDays: 0, recentActiveDays: 1,
    })
  })

  it('aggregates multiple days and distinguishes all-time from recent activity', () => {
    expect(derive([
      progressSourceDay('2026-10-01', [true, true]),
      progressSourceDay('2026-10-08', [false, false]),
      progressSourceDay('2026-10-10', [true, false, true]),
      progressSourceDay('2026-10-11', [true, true]),
    ])).toMatchObject({ planDays: 4, totalActions: 9, completedActions: 6, activeDays: 3, fullyCompletedDays: 2, recentActiveDays: 2 })
  })

  it.each([
    { completed: [], active: false, full: false },
    { completed: [false], active: false, full: false },
    { completed: [true], active: true, full: false },
    { completed: [false, false], active: false, full: false },
    { completed: [true, false], active: true, full: false },
    { completed: [true, true], active: true, full: true },
    { completed: [true, true, true, true], active: true, full: true },
    { completed: [true, true, true, true, true], active: true, full: false },
  ])('defines day activity and validity for $completed', ({ completed, active, full }) => {
    const snapshot = derive([progressSourceDay('2026-10-11', completed)])
    expect(snapshot).toMatchObject({
      totalActions: completed.length, completedActions: completed.filter(Boolean).length,
      activeDays: Number(active), fullyCompletedDays: Number(full),
    })
    expect(snapshot.recentDays.at(-1)).toMatchObject({ isActive: active, isFullyComplete: full })
  })

  it('naturally changes all derived counts when a completed action is reopened', () => {
    const source = progressSourceDay('2026-10-11', [true, true])
    expect(derive([source]).fullyCompletedDays).toBe(1)
    const updated = { ...source, steps: source.steps.map(uncompleteDailyStep) }
    expect(derive([updated])).toMatchObject({ totalActions: 2, completedActions: 0, activeDays: 0, fullyCompletedDays: 0 })
  })

  it('uses exactly seven calendar days ending today, including gaps', () => {
    const snapshot = derive([
      progressSourceDay('2026-10-04', [true, true]),
      progressSourceDay('2026-10-05', [true, false]),
      progressSourceDay('2026-10-11', [true, true]),
      progressSourceDay('2026-10-12', [true, true]),
    ])
    expect(snapshot.recentDays.map(day => day.localDate)).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ])
    expect(snapshot).toMatchObject({ completedActions: 5, recentActiveDays: 2, planDays: 3 })
    expect(snapshot.recentDays[1]).toMatchObject({ hasPlan: false, totalSteps: 0 })
  })

  it('keeps the seven-day denominator when the Journey began less than seven days ago', () => {
    const snapshot = deriveProgressSnapshot(progressJourney('2026-10-10T09:00:00Z'), [
      progressSourceDay('2026-10-10', [true, true]),
    ], '2026-10-11', '2026-10-10')
    expect(snapshot.recentDays.filter(day => day.isBeforeJourney)).toHaveLength(5)
    expect(snapshot).toMatchObject({ recentActiveDays: 1, journeyElapsedDays: 2 })
  })

  it('keeps activity on the plan date regardless of a completion timestamp boundary', () => {
    const source = progressSourceDay('2026-10-10', [true, false])
    source.steps[0] = { ...source.steps[0]!, completedAt: '2026-10-11T00:01:00+05:45' }
    const snapshot = derive([source])
    expect(snapshot.recentDays.find(day => day.localDate === '2026-10-10')?.completedSteps).toBe(1)
    expect(snapshot.recentDays.at(-1)?.completedSteps).toBe(0)
  })

  it('isolates Journeys even when dates overlap', () => {
    expect(derive([
      progressSourceDay('2026-10-11', [true, false]),
      progressSourceDay('2026-10-11', [true, true], 'jr_other'),
    ])).toMatchObject({ totalActions: 2, completedActions: 1, planDays: 1 })
  })

  it('is independent of history and step ordering and does not mutate sources', () => {
    const history = [progressSourceDay('2026-10-11', [true, false]), progressSourceDay('2026-10-01', [true, true])]
    const before = JSON.stringify(history)
    expect(derive(history)).toEqual(derive([...history].reverse().map(source => ({ ...source, steps: [...source.steps].reverse() }))))
    expect(JSON.stringify(history)).toBe(before)
  })

  it('distinguishes a plan with no steps from a missing plan', () => {
    const snapshot = derive([progressSourceDay('2026-10-11')])
    expect(snapshot.recentDays.at(-1)).toMatchObject({ hasPlan: true, totalSteps: 0, isFullyComplete: false })
    expect(snapshot.recentDays[0]).toMatchObject({ hasPlan: false, totalSteps: 0 })
  })

  it('reports inclusive Journey time without capping it or implying achievement', () => {
    expect(derive([])).toMatchObject({ journeyElapsedDays: 11, journeyDurationDays: 45 })
    expect(deriveProgressSnapshot(journey, [], '2026-11-20', '2026-10-01').journeyElapsedDays).toBe(51)
    expect(deriveProgressSnapshot(journey, [], '2026-09-30', '2026-10-01').journeyElapsedDays).toBe(0)
  })
})
